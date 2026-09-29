import { storage } from "@vendetta/plugin";
import { before as patchBefore, after as patchAfter } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";

if (storage.enabled === undefined) storage.enabled = true;

const faked = new Map();
const patches = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function forceRefresh(channelId, messageId, content, embeds) {
  const Dispatcher = findByProps("dispatch", "subscribe");
  if (!Dispatcher || !channelId || !messageId) return;
  Dispatcher.dispatch({
    type: "MESSAGE_UPDATE",
    message: { id: messageId, channel_id: channelId, content: content + " ", embeds: embeds || [] }
  });
  await sleep(60);
  Dispatcher.dispatch({
    type: "MESSAGE_UPDATE",
    message: { id: messageId, channel_id: channelId, content: content, embeds: embeds || [] }
  });
}

function openEditModal(message) {
  const Sheets = findByProps("openLazy", "hideActionSheet");
  try {
    if (Sheets && Sheets.hideActionSheet) Sheets.hideActionSheet();
  } catch (e) {}
  let alertKit = null;
  let modalKit = null;
  try {
    alertKit = findByProps("openAlert", "dismissAlert");
    modalKit = findByProps("AlertModal", "AlertActions");
  } catch (e) {}
  if (!alertKit || !modalKit || !modalKit.AlertModal) {
    showToast("Alertas indisponiveis neste client", { type: "error" });
    return;
  }
  const { openAlert, dismissAlert } = alertKit;
  const { AlertModal, AlertActionButton } = modalKit;
  const alertId = "fakechat-edit-" + message.id;
  const EditBox = () => {
    const [text, setText] = React.useState(String(message.content || ""));
    return React.createElement(AlertModal, {
      title: "Editar mensagem",
      content: "So voce ve essa edicao",
      extraContent: React.createElement(ReactNative.TextInput, {
        value: text,
        onChangeText: setText,
        multiline: true,
        autoFocus: true,
        style: { color: "#dbdee1", backgroundColor: "#2b2d31", borderRadius: 8, padding: 10, minHeight: 80, textAlignVertical: "top" }
      }),
      actions: React.createElement(React.Fragment, null,
        React.createElement(AlertActionButton, {
          text: "Salvar",
          variant: "primary",
          onPress: () => {
            const channelId = message.channel_id || message.channelId;
            const next = String(text || "");
            if (!faked.has(message.id) && !message._fakeOriginal) {
              faked.set(message.id, String(message.content || ""));
              message._fakeOriginal = String(message.content || "");
            }
            dismissAlert(alertId);
            forceRefresh(channelId, message.id, next, message.embeds);
            showToast("Mensagem editada (fake)");
          }
        }),
        React.createElement(AlertActionButton, {
          text: "Cancelar",
          variant: "secondary",
          onPress: () => dismissAlert(alertId)
        })
      )
    });
  };
  try {
    openAlert(alertId, React.createElement(EditBox, null));
  } catch (e) {
    showToast("Falha ao abrir editor", { type: "error" });
  }
}

function openImpersonateModal(message) {
  const Sheets = findByProps("openLazy", "hideActionSheet");
  try {
    if (Sheets && Sheets.hideActionSheet) Sheets.hideActionSheet();
  } catch (e) {}
  let alertKit = null;
  let modalKit = null;
  try {
    alertKit = findByProps("openAlert", "dismissAlert");
    modalKit = findByProps("AlertModal", "AlertActions");
  } catch (e) {}
  if (!alertKit || !modalKit || !modalKit.AlertModal) {
    showToast("Alertas indisponiveis neste client", { type: "error" });
    return;
  }
  const { openAlert, dismissAlert } = alertKit;
  const { AlertModal, AlertActionButton } = modalKit;
  const origAuthor = message.author || {};
  const defaultName = String(origAuthor.username || origAuthor.globalName || "");
  const defaultText = "<@" + String(origAuthor.id || "") + "> ";
  const alertId = "fakechat-fingir-" + message.id + "-" + String(Date.now());
  const FakeBox = () => {
    const [nome, setNome] = React.useState(defaultName);
    const [texto, setTexto] = React.useState(defaultText);
    return React.createElement(AlertModal, {
      title: "Fingir mensagem",
      content: "Envia fake como essa pessoa, so local",
      extraContent: React.createElement(ReactNative.View, { style: { gap: 8 } },
        React.createElement(ReactNative.TextInput, {
          value: nome,
          onChangeText: setNome,
          autoFocus: false,
          placeholder: "Nome a exibir",
          placeholderTextColor: "#87898c",
          style: { color: "#dbdee1", backgroundColor: "#2b2d31", borderRadius: 8, padding: 10, minHeight: 44 }
        }),
        React.createElement(ReactNative.TextInput, {
          value: texto,
          onChangeText: setTexto,
          multiline: true,
          autoFocus: true,
          placeholder: "Mensagem, use @ para mencionar",
          placeholderTextColor: "#87898c",
          style: { color: "#dbdee1", backgroundColor: "#2b2d31", borderRadius: 8, padding: 10, minHeight: 80, textAlignVertical: "top" }
        })
      ),
      actions: React.createElement(React.Fragment, null,
        React.createElement(AlertActionButton, {
          text: "Enviar",
          variant: "primary",
          onPress: () => {
            const Dispatcher = findByProps("dispatch", "subscribe");
            const channelId = message.channel_id || message.channelId;
            const finalName = String(nome || "").trim() || defaultName || "Alguem";
            const finalText = String(texto || "").trim();
            if (!finalText) {
              showToast("Mensagem vazia", { type: "error" });
              return;
            }
            const fakeAuthor = Object.assign({}, origAuthor, { username: finalName, globalName: finalName });
            const fakeId = "890" + String(Date.now()) + String(Math.floor(Math.random() * 900) + 100);
            dismissAlert(alertId);
            try {
              Dispatcher.dispatch({
                type: "MESSAGE_CREATE",
                message: {
                  id: fakeId,
                  channel_id: channelId,
                  channelId: channelId,
                  author: fakeAuthor,
                  content: finalText,
                  timestamp: new Date().toISOString(),
                  edited_timestamp: null,
                  type: 0,
                  flags: 0,
                  mentions: [],
                  mention_roles: [],
                  mention_everyone: false,
                  pinned: false,
                  tts: false
                }
              });
              showToast("Fake enviado como " + finalName);
            } catch (e) {
              showToast("Falha ao enviar fake", { type: "error" });
            }
          }
        }),
        React.createElement(AlertActionButton, {
          text: "Cancelar",
          variant: "secondary",
          onPress: () => dismissAlert(alertId)
        })
      )
    });
  };
  try {
    openAlert(alertId, React.createElement(FakeBox, null));
  } catch (e) {
    showToast("Falha ao abrir editor", { type: "error" });
  }
}

function restoreOriginal(message) {  const Sheets = findByProps("openLazy", "hideActionSheet");
  try {
    if (Sheets && Sheets.hideActionSheet) Sheets.hideActionSheet();
  } catch (e) {}
  const orig = message._fakeOriginal || faked.get(message.id);
  if (!orig) {
    showToast("Nada para restaurar", { type: "error" });
    return;
  }
  const channelId = message.channel_id || message.channelId;
  delete message._fakeOriginal;
  faked.delete(message.id);
  forceRefresh(channelId, message.id, orig, message.embeds);
  showToast("Original restaurado");
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
    if (typeof message.content !== "string") return;
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
            iconSrc = getAssetIDByName("ic_message_edit_24px") || getAssetIDByName("ic_edit_24px") || getAssetIDByName("ic_chat_24px");
          } catch (e) {}
          const isFaked = Boolean(message._fakeOriginal || faked.has(message.id));
          const editBtn = React.createElement(RowComp, {
            label: "Editar fake",
            icon: iconSrc ? React.createElement(RowComp.Icon, { source: iconSrc }) : null,
            onPress: () => openEditModal(message)
          });
          const undoBtn = React.createElement(RowComp, {
            label: "Desfazer fake",
            icon: iconSrc ? React.createElement(RowComp.Icon, { source: iconSrc }) : null,
            onPress: () => restoreOriginal(message)
          });
          const fingirBtn = React.createElement(RowComp, {
            label: "Fingir como ele",
            icon: iconSrc ? React.createElement(RowComp.Icon, { source: iconSrc }) : null,
            onPress: () => openImpersonateModal(message)
          });
          const toAdd = isFaked ? [editBtn, fingirBtn, undoBtn] : [editBtn, fingirBtn];
          let inserted = false;
          for (let gi = 0; gi < groups.length; gi++) {
            let kids = null;
            try {
              kids = findInReactTree(groups[gi], (c) => Array.isArray(c) && c.some((ch) => ch && ch.type && ch.type.name === "ActionSheetRow"));
            } catch (e) {}
            if (!kids) continue;
            for (let i = toAdd.length - 1; i >= 0; i--) kids.unshift(toAdd[i]);
            inserted = true;
            break;
          }
          if (!inserted) {
            try {
              groups.unshift(React.createElement(RowComp.Group, null, toAdd));
            } catch (e) {}
          }
        });
      });
    } catch (e) {}
  });
}

function Settings() {
  useProxy(storage);
  return React.createElement(React.Fragment, null,
    React.createElement(Forms.FormSwitchRow, {
      label: "Ativado",
      subLabel: "Mostra opcoes fake ao segurar mensagem",
      value: storage.enabled !== false,
      onValueChange: (v) => { storage.enabled = v; }
    }),
    React.createElement(Forms.FormRow, {
      label: "Aviso",
      subLabel: "Edicao so local, ninguem mais ve"
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
  },
  onLoad() {
    try {
      const u = patchMenu();
      if (u) patches.push(u);
    } catch (e) {}
  }
};
