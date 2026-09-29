import { storage } from "@vendetta/plugin";
import { before as patchBefore } from "@vendetta/patcher";
import { findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

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

async function handleMessage(message) {
  if (!storage.autoTranslate) return;
  if (!message) return;
  if (!UserStore) UserStore = findByStoreName("UserStore");
  if (shouldSkip(message)) return;
  pending.add(message.id);
  try {
    const t = await translateText(message.content);
    applyTranslation(message, t);
    FluxDispatcher.dispatch({ type: "MESSAGE_UPDATE", message: message });
  } catch (e) {
    showToast("Falha ao traduzir: " + String(e.message || e).slice(0, 80), { type: "error" });
  } finally {
    pending.delete(message.id);
  }
}

const patches = [];

const LANGS = [
  { label: "Portugues", value: "pt" },
  { label: "English", value: "en" },
  { label: "Espanol", value: "es" },
  { label: "Francais", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Italiano", value: "it" },
  { label: "Japones", value: "ja" },
  { label: "Coreano", value: "ko" },
  { label: "Chines", value: "zh-CN" },
  { label: "Russo", value: "ru" }
];

function Settings() {
  useProxy(storage);
  const [custom, setCustom] = React.useState(storage.targetLang || "pt");
  function setTarget(v) {
    const nv = String(v || "").trim().toLowerCase() || "pt";
    storage.targetLang = nv;
    setCustom(nv);
  }
  const rows = [];
  rows.push(React.createElement(Forms.FormSwitchRow, {
    key: "auto",
    label: "Traducao automatica",
    subLabel: "Traduzir mensagens novas assim que chegam",
    value: storage.autoTranslate !== false,
    onValueChange: (v) => { storage.autoTranslate = v; }
  }));
  rows.push(React.createElement(Forms.FormSwitchRow, {
    key: "orig",
    label: "Mostrar original",
    subLabel: "Exibe o texto original junto com a traducao",
    value: storage.showOriginal !== false,
    onValueChange: (v) => { storage.showOriginal = v; }
  }));
  rows.push(React.createElement(Forms.FormSwitchRow, {
    key: "self",
    label: "Traduzir proprias mensagens",
    subLabel: "Inclui mensagens enviadas por voce",
    value: storage.translateSelf === true,
    onValueChange: (v) => { storage.translateSelf = v; }
  }));
  rows.push(React.createElement(Forms.FormSwitchRow, {
    key: "bots",
    label: "Ignorar bots",
    subLabel: "Nao traduz mensagens de bots",
    value: storage.ignoreBots !== false,
    onValueChange: (v) => { storage.ignoreBots = v; }
  }));
  rows.push(React.createElement(Forms.FormRow, {
    key: "langtitle",
    label: "Idioma destino",
    subLabel: "Atual: " + String(storage.targetLang || "pt")
  }));
  for (const l of LANGS) {
    rows.push(React.createElement(Forms.FormRadioRow, {
      key: l.value,
      label: l.label,
      subLabel: l.value,
      selected: String(storage.targetLang || "pt").toLowerCase() === l.value,
      onPress: () => setTarget(l.value)
    }));
  }
  rows.push(React.createElement(Forms.FormInput, {
    key: "custom",
    title: "Idioma personalizado",
    placeholder: "ex: pt, en, es, fr",
    value: custom,
    onChange: (v) => setCustom(v),
    onBlur: () => { if (custom && custom.trim()) setTarget(custom); }
  }));
  rows.push(React.createElement(Forms.FormRow, {
    key: "enginetitle",
    label: "Engine",
    subLabel: storage.engine === "mymemory" ? "MyMemory" : "Google"
  }));
  rows.push(React.createElement(Forms.FormRadioRow, {
    key: "google",
    label: "Google",
    subLabel: "Rapido e gratis",
    selected: storage.engine !== "mymemory",
    onPress: () => { storage.engine = "google"; }
  }));
  rows.push(React.createElement(Forms.FormRadioRow, {
    key: "mymemory",
    label: "MyMemory",
    subLabel: "Alternativo com fallback",
    selected: storage.engine === "mymemory",
    onPress: () => { storage.engine = "mymemory"; }
  }));
  return React.createElement(React.Fragment, null, rows);
}

export default {
  settings: Settings,
  onUnload() {
    for (const u of patches) {
      try { u(); } catch (e) {}
    }
    patches.length = 0;
    cache.clear();
    done.clear();
    pending.clear();
  },
  onLoad() {
    try { UserStore = findByStoreName("UserStore"); } catch (e) {}
    patches.push(
      patchBefore("dispatch", FluxDispatcher, (args) => {
        const ev = args[0];
        if (!ev || !ev.type) return args;
        if (ev.type === "MESSAGE_CREATE") {
          const m = ev.message;
          if (m && m.content) setTimeout(() => handleMessage(m), 50);
        }
        if (ev.type === "MESSAGE_UPDATE") {
          const m = ev.message;
          if (m && m.content && !m._ctTranslated && !done.has(m.id)) {
            if (storage.autoTranslate) setTimeout(() => handleMessage(m), 50);
          }
        }
        return args;
      })
    );
  }
};
