import { storage } from "@vendetta/plugin";
import { before as patchBefore, after as patchAfter } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import settings from "./settings.jsx";

const defaults = {
  targetLang: "pt",
  autoTranslate: false,
  showOriginal: true,
  translateSelf: true,
  ignoreBots: true,
  engine: "google"
};

for (const k of Object.keys(defaults)) {
  if (storage[k] === undefined) storage[k] = defaults[k];
}

let UserStore = null;
const cache = new Map();
const done = new Set();
const pending = new Set();
const patches = [];

function cacheKey(text, lang) {
  return lang + "::" + text;
}

async function translateGoogle(text, lang) {
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + encodeURIComponent(lang) + "&dt=t&q=" + encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error("google " + res.status);
  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("google bad response");
  return data[0].map((p) => p[0]).join("");
}

async function translateMyMemory(text, lang) {
  const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=auto|" + encodeURIComponent(lang);
  const res = await fetch(url);
  if (!res.ok) throw new Error("mymemory " + res.status);
  const data = await res.json();
  const out = data && data.responseData && data.responseData.translatedText;
  if (!out) throw new Error("mymemory bad response");
  return out;
}

export async function translateText(text) {
  const lang = String(storage.targetLang || "pt").toLowerCase();
  const key = cacheKey(text, lang);
  if (cache.has(key)) return cache.get(key);
  let out = "";
  if (storage.engine === "mymemory") {
    try {
      out = await translateMyMemory(text, lang);
    } catch (e) {
      out = await translateGoogle(text, lang);
    }
  } else {
    try {
      out = await translateGoogle(text, lang);
    } catch (e) {
      out = await translateMyMemory(text, lang);
    }
  }
  cache.set(key, out);
  if (cache.size > 500) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  return out;
}

function cleanSource(input) {
  const raw = typeof input === "string" ? input : (input && input.content) || "";
  return String(raw).split("\n\u200b\u200b")[0].trim();
}

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

function applyToChat(message, translated) {
  const src = cleanSource(message);
  if (!translated || !translated.trim()) return;
  const channelId = message.channel_id || message.channelId;
  const final = storage.showOriginal ? src + "\n\u200b\u200b" + translated : translated;
  done.add(message.id);
  forceRefresh(channelId, message.id, final, message.embeds);
}

function runManualTranslate(message) {
  const ActionSheet = findByProps("openLazy", "hideActionSheet");
  try {
    if (ActionSheet && ActionSheet.hideActionSheet) ActionSheet.hideActionSheet();
  } catch (e) {}
  const src = cleanSource(message);
  if (!src) {
    showToast("Mensagem vazia", { type: "error" });
    return;
  }
  showToast("Traduzindo...", { type: "open" });
  translateText(src).then((t) => {
    showConfirmationAlert({
      title: "Traducao",
      content: t,
      confirmText: "Aplicar no chat",
      cancelText: "Fechar",
      onConfirm: () => applyToChat(message, t)
    });
  }).catch((e) => {
    showToast("Falha ao traduzir: " + String((e && e.message) || e).slice(0, 80), { type: "error" });
  });
}

function shouldSkip(message) {
  if (!message || typeof message.content !== "string") return true;
  if (!message.content.trim()) return true;
  if (message._ctTranslated) return true;
  if (done.has(message.id)) return true;
  if (pending.has(message.id)) return true;
  if (storage.ignoreBots && message.author && message.author.bot) return true;
  if (!storage.translateSelf && UserStore && message.author && UserStore.getCurrentUser && UserStore.getCurrentUser().id === message.author.id) return true;
  if (message.content.includes("\n\u200b\u200b")) return true;
  return false;
}

async function handleMessage(message) {
  if (!storage.autoTranslate) return;
  if (!message) return;
  if (!UserStore) {
    try {
      UserStore = findByStoreName("UserStore");
    } catch (e) {}
  }
  if (shouldSkip(message)) return;
  pending.add(message.id);
  try {
    const t = await translateText(cleanSource(message));
    applyToChat(message, t);
  } catch (e) {
    showToast("Falha ao traduzir: " + String((e && e.message) || e).slice(0, 80), { type: "error" });
  } finally {
    pending.delete(message.id);
  }
}

let sheetUnpatch = null;

function patchMessageMenu() {
  let ActionSheet = null;
  let RowComp = null;
  try {
    ActionSheet = findByProps("openLazy", "hideActionSheet");
    const found = findByProps("ActionSheetRow");
    RowComp = (found && found.ActionSheetRow) || null;
  } catch (e) {}
  if (!ActionSheet || !RowComp) return null;
  return patchBefore("openLazy", ActionSheet, ([comp, args, msg]) => {
    if (args !== "MessageLongPressActionSheet") return;
    if (!msg || !msg.message) return;
    const message = msg.message;
    if (!message.content || !String(message.content).trim()) return;
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
            iconSrc = getAssetIDByName("ic_translate_24px") || getAssetIDByName("ic_chat_24px");
          } catch (e) {}
          const btn = React.createElement(RowComp, {
            label: "Traduzir",
            icon: iconSrc ? React.createElement(RowComp.Icon, { source: iconSrc }) : null,
            onPress: () => runManualTranslate(message)
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
              groups.unshift(React.createElement(RowComp.Group, null, btn));
            } catch (e) {}
          }
        });
      });
    } catch (e) {}
  });
}

export default {
  settings,
  onUnload() {
    for (const u of patches) {
      try {
        u();
      } catch (e) {}
    }
    patches.length = 0;
    try {
      if (sheetUnpatch) sheetUnpatch();
    } catch (e) {}
    sheetUnpatch = null;
    cache.clear();
    done.clear();
    pending.clear();
  },
  onLoad() {
    try {
      UserStore = findByStoreName("UserStore");
    } catch (e) {}
    try {
      sheetUnpatch = patchMessageMenu();
      if (sheetUnpatch) patches.push(sheetUnpatch);
    } catch (e) {}
    patches.push(
      patchBefore("dispatch", FluxDispatcher, (args) => {
        const ev = args[0];
        if (!ev || !ev.type) return args;
        if (ev.type === "MESSAGE_CREATE") {
          const m = ev.message;
          if (m && m.content && storage.autoTranslate) setTimeout(() => handleMessage(m), 80);
        }
        return args;
      })
    );
  }
};
