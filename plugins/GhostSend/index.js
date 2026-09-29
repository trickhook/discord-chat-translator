import { storage } from "@vendetta/plugin";
import { before as patchBefore, after as patchAfter } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";

if (storage.enabled === undefined) storage.enabled = true;
if (storage.secs === undefined) storage.secs = 10;

const timers = new Map();
const patches = [];

function isOwn(message) {
  try {
    const UserStore = findByStoreName("UserStore");
    const me = UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();
    return Boolean(me && message && message.author && String(me.id) === String(message.author.id));
  } catch (e) {
    return false;
  }
}

function localDelete(channelId, messageId) {
  try {
    const Dispatcher = findByProps("dispatch", "subscribe");
    Dispatcher.dispatch({ type: "MESSAGE_DELETE", channelId: channelId, id: messageId });
  } catch (e) {}
}

function fireDelete(message) {
  const channelId = message.channel_id || message.channelId;
  const messageId = message.id;
  try {
    const api = findByProps("deleteMessage");
    if (api && api.deleteMessage) {
      Promise.resolve(api.deleteMessage(channelId, messageId)).catch(() => localDelete(channelId, messageId));
    } else {
      localDelete(channelId, messageId);
    }
  } catch (e) {
    localDelete(channelId, messageId);
  }
  timers.delete(messageId);
  showToast("Mensagem fantasma apagada");
}

function armGhost(message) {
  const Sheets = findByProps("openLazy", "hideActionSheet");
  try {
    if (Sheets && Sheets.hideActionSheet) Sheets.hideActionSheet();
  } catch (e) {}
  const secs = Number(storage.secs) || 10;
  if (timers.has(message.id)) {
    try {
      clearTimeout(timers.get(message.id));
    } catch (e) {}
    timers.delete(message.id);
    showToast("Fantasma cancelado");
    return;
  }
  const t = setTimeout(() => fireDelete(message), secs * 1000);
  timers.set(message.id, t);
  showToast("Apaga em " + String(secs) + "s");
}

function patchMenu() {
  let ActionSheet = null;
  let RowComp = null;
  try {
    ActionSheet = findByProps("openLazy", "hideActionSheet");
    const found = findByProps("ActionSheetRow");
    RowComp = (found && found.ActionSheetRow) || null;
  } catch (e) {}
  if (!ActionSheet || !RowComp) return null;
  return patchBefore("openLazy", ActionSheet, ([comp, args, msg]) => {
    if (storage.enabled === false) return;
    if (args !== "MessageLongPressActionSheet") return;
    if (!msg || !msg.message) return;
    const message = msg.message;
    if (!isOwn(message)) return;
    try {
      comp.then((instance) => {
        const unpatch = patchAfter("default", instance, (_a, component) => {
          React.useEffect(() => () => {
            try {
              unpatch();
            } catch (e) {}
          }, []);
          let groups = null;
          try {
            groups = findInReactTree(component, (c) => Array.isArray(c) && c[0] && c[0].type && c[0].type.name === "ActionSheetRowGroup");
          } catch (e) {}
          if (!groups || !groups.length) return;
          let iconSrc = null;
          try {
            iconSrc = getAssetIDByName("ic_hide_24px") || getAssetIDByName("ic_chat_24px");
          } catch (e) {}
          const armed = timers.has(message.id);
          const btn = React.createElement(RowComp, {
            label: armed ? "Cancelar fantasma" : "Fantasma " + String(Number(storage.secs) || 10) + "s",
            icon: iconSrc ? React.createElement(RowComp.Icon, { source: iconSrc }) : null,
            onPress: () => armGhost(message)
          });
          let inserted = false;
          for (let gi = 0; gi < groups.length; gi++) {
            let kids = null;
            try {
              kids = findInReactTree(groups[gi], (c) => Array.isArray(c) && c.some((ch) => ch && ch.type && ch.type.name === "ActionSheetRow"));
            } catch (e) {}
            if (!kids) continue;
            kids.unshift(btn);
            inserted = true;
            break;
          }
          if (!inserted) {
            try {
              groups.unshift(React.createElement(RowComp.Group, null, [btn]));
            } catch (e) {}
          }
        });
      });
    } catch (e) {}
  });
}

function Settings() {
  useProxy(storage);
  const secs = String(storage.secs || 10);
  return React.createElement(React.Fragment, null,
    React.createElement(Forms.FormSwitchRow, {
      label: "Ativado",
      subLabel: "Mostra Fantasma ao segurar sua mensagem",
      value: storage.enabled !== false,
      onValueChange: (v) => { storage.enabled = v; }
    }),
    React.createElement(Forms.FormRow, {
      label: "Tempo",
      subLabel: "Atual: " + secs + "s"
    }),
    ["5", "10", "30", "60"].map((s) => React.createElement(Forms.FormRadioRow, {
      key: s,
      label: s + " segundos",
      selected: secs === s,
      onPress: () => { storage.secs = Number(s); }
    })),
    React.createElement(Forms.FormRow, {
      label: "Aviso",
      subLabel: "Apaga de verdade via API, some para todos"
    })
  );
}

export default {
  settings: Settings,
  onUnload() {
    for (const u of patches) {
      try {
        u();
      } catch (e) {}
    }
    patches.length = 0;
    for (const t of timers.values()) {
      try {
        clearTimeout(t);
      } catch (e) {}
    }
    timers.clear();
  },
  onLoad() {
    try {
      const u = patchMenu();
      if (u) patches.push(u);
    } catch (e) {}
  }
};
