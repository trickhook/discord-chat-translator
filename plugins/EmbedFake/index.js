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

function openEmbedModal(message) {
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
  const alertId = "embedfake-" + message.id + "-" + String(Date.now());
  const FakeBox = () => {
    const [titulo, setTitulo] = React.useState("Noticia urgente");
    const [desc, setDesc] = React.useState("Clique para ver");
    const [link, setLink] = React.useState("https://discord.com/");
    const [imagem, setImagem] = React.useState("");
    const field = (val, set, ph) => React.createElement(ReactNative.TextInput, {
      value: val,
      onChangeText: set,
      placeholder: ph,
      placeholderTextColor: "#87898c",
      style: { color: "#dbdee1", backgroundColor: "#2b2d31", borderRadius: 8, padding: 10, minHeight: 44 }
    });
    return React.createElement(AlertModal, {
      title: "Embed fake",
      content: "Preview falso so local",
      extraContent: React.createElement(ReactNative.View, { style: { gap: 8 } },
        field(titulo, setTitulo, "Titulo"),
        field(desc, setDesc, "Descricao"),
        field(link, setLink, "Link https://..."),
        field(imagem, setImagem, "Imagem https://... (opcional)")
      ),
      actions: React.createElement(React.Fragment, null,
        React.createElement(AlertActionButton, {
          text: "Aplicar",
          variant: "primary",
          onPress: () => {
            const channelId = message.channel_id || message.channelId;
            const t = String(titulo || "").trim() || "Link";
            const d = String(desc || "").trim();
            const u = String(link || "").trim() || "https://discord.com/";
            const img = String(imagem || "").trim();
            const embed = { type: "rich", title: t, description: d, url: u, color: 5814783 };
            if (img) embed.image = { url: img };
            if (img) embed.thumbnail = { url: img };
            const embeds = [].concat(message.embeds || [], [embed]);
            dismissAlert(alertId);
            forceRefresh(channelId, message.id, String(message.content || ""), embeds);
            showToast("Embed fake aplicado");
          }
        }),
        React.createElement(AlertActionButton, {
          text: "Limpar",
          variant: "secondary",
          onPress: () => {
            const channelId = message.channel_id || message.channelId;
            dismissAlert(alertId);
            forceRefresh(channelId, message.id, String(message.content || ""), []);
            showToast("Embeds removidos");
          }
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
            iconSrc = getAssetIDByName("ic_link_24px") || getAssetIDByName("ic_chat_24px");
          } catch (e) {}
          const btn = React.createElement(RowComp, {
            label: "Embed fake",
            icon: iconSrc ? React.createElement(RowComp.Icon, { source: iconSrc }) : null,
            onPress: () => openEmbedModal(message)
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
  return React.createElement(React.Fragment, null,
    React.createElement(Forms.FormSwitchRow, {
      label: "Ativado",
      subLabel: "Mostra Embed fake ao segurar mensagem",
      value: storage.enabled !== false,
      onValueChange: (v) => { storage.enabled = v; }
    }),
    React.createElement(Forms.FormRow, {
      label: "Aviso",
      subLabel: "Preview so local, ninguem mais ve"
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
