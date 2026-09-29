import { storage } from "@vendetta/plugin";
import { before as patchBefore } from "@vendetta/patcher";
import { findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import settings from "./settings.jsx";

const defaults = {
  targetLang: "pt",
  autoTranslate: true,
  showOriginal: true,
  translateSelf: false,
  ignoreBots: true,
  engine: "google"
};

for (const k of Object.keys(defaults)) {
  if (storage[k] === undefined) storage[k] = defaults[k];
}

let UserStore = null;
let MessageStore = null;
let ChannelStore = null;
const cache = new Map();
const done = new Set();
const pending = new Set();

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

function applyTranslation(message, translated) {
  if (!translated || !translated.trim()) return;
  if (translated.trim().toLowerCase() === message.content.trim().toLowerCase()) return;
  message._ctOriginal = message.content;
  message._ctTranslated = translated;
  if (storage.showOriginal) {
    message.content = message._ctOriginal + "\n\u200b\u200b" + translated;
  } else {
    message.content = translated;
  }
  done.add(message.id);
}

async function handleMessage(channelId, message) {
  if (!storage.autoTranslate) return;
  if (!message) return;
  if (!UserStore) UserStore = findByStoreName("UserStore");
  if (shouldSkip(message)) return;
  pending.add(message.id);
  try {
    const t = await translateText(message.content);
    applyTranslation(message, t);
    FluxDispatcher.dispatch({
      type: "MESSAGE_UPDATE",
      message: message
    });
  } catch (e) {
    showToast("Falha ao traduzir: " + String(e.message || e).slice(0, 80), { type: "error" });
  } finally {
    pending.delete(message.id);
  }
}

const patches = [];

export function translateManually(message) {
  if (!message || typeof message.content !== "string") return Promise.resolve("");
  const src = message._ctOriginal || message.content.split("\n\u200b\u200b")[0];
  return translateText(src).then((t) => {
    applyTranslation(message, t);
    FluxDispatcher.dispatch({ type: "MESSAGE_UPDATE", message });
    return t;
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
    cache.clear();
    done.clear();
    pending.clear();
  },
  onLoad() {
    try {
      UserStore = findByStoreName("UserStore");
      MessageStore = findByStoreName("MessageStore");
      ChannelStore = findByStoreName("ChannelStore");
    } catch (e) {}
    patches.push(
      patchBefore("dispatch", FluxDispatcher, (args) => {
        const ev = args[0];
        if (!ev || !ev.type) return args;
        if (ev.type === "MESSAGE_CREATE") {
          const m = ev.message;
          if (m && m.content) {
            setTimeout(() => handleMessage(m.channel_id || m.channelId, m), 50);
          }
        }
        if (ev.type === "MESSAGE_UPDATE") {
          const m = ev.message;
          if (m && m.content && !m._ctTranslated && !done.has(m.id)) {
            if (storage.autoTranslate) {
              setTimeout(() => handleMessage(m.channel_id || m.channelId, m), 50);
            }
          }
        }
        return args;
      })
    );
  }
};
