(function(exports,plugin,patcher,metro,common,toasts,storage,components){'use strict';const LANGS = [
    {
        label: "Portugues",
        value: "pt"
    },
    {
        label: "English",
        value: "en"
    },
    {
        label: "Espanol",
        value: "es"
    },
    {
        label: "Francais",
        value: "fr"
    },
    {
        label: "Deutsch",
        value: "de"
    },
    {
        label: "Italiano",
        value: "it"
    },
    {
        label: "Japones",
        value: "ja"
    },
    {
        label: "Coreano",
        value: "ko"
    },
    {
        label: "Chines",
        value: "zh-CN"
    },
    {
        label: "Russo",
        value: "ru"
    }
];
function settings() {
    storage.useProxy(plugin.storage);
    const [lang, setLang] = common.React.useState(plugin.storage.targetLang || "pt");
    const [custom, setCustom] = common.React.useState(plugin.storage.targetLang || "pt");
    function setTarget(v) {
        const nv = String(v || "").trim().toLowerCase() || "pt";
        plugin.storage.targetLang = nv;
        setLang(nv);
        setCustom(nv);
    }
    return /*#__PURE__*/ common.React.createElement(common.React.Fragment, null, /*#__PURE__*/ common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Traducao automatica",
        subLabel: "Traduzir mensagens novas assim que chegam",
        value: plugin.storage.autoTranslate !== false,
        onValueChange: function(v) {
            plugin.storage.autoTranslate = v;
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Mostrar original",
        subLabel: "Exibe o texto original junto com a traducao",
        value: plugin.storage.showOriginal !== false,
        onValueChange: function(v) {
            plugin.storage.showOriginal = v;
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Traduzir proprias mensagens",
        subLabel: "Inclui mensagens enviadas por voce",
        value: plugin.storage.translateSelf === true,
        onValueChange: function(v) {
            plugin.storage.translateSelf = v;
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Ignorar bots",
        subLabel: "Nao traduz mensagens de bots",
        value: plugin.storage.ignoreBots !== false,
        onValueChange: function(v) {
            plugin.storage.ignoreBots = v;
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormRow, {
        label: "Idioma destino",
        subLabel: "Atual: " + String(plugin.storage.targetLang || "pt")
    }), LANGS.map(function(l) {
        return /*#__PURE__*/ common.React.createElement(components.Forms.FormRadioRow, {
            key: l.value,
            label: l.label,
            subLabel: l.value,
            selected: String(plugin.storage.targetLang || "pt").toLowerCase() === l.value,
            onPress: function() {
                return setTarget(l.value);
            }
        });
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormInput, {
        title: "Idioma personalizado",
        placeholder: "ex: pt, en, es, fr",
        value: custom,
        onChange: function(v) {
            return setCustom(v);
        },
        onBlur: function() {
            if (custom && custom.trim()) setTarget(custom);
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormRow, {
        label: "Engine",
        subLabel: plugin.storage.engine === "mymemory" ? "MyMemory" : "Google"
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormRadioRow, {
        label: "Google",
        subLabel: "Rapido e gratis",
        selected: plugin.storage.engine !== "mymemory",
        onPress: function() {
            plugin.storage.engine = "google";
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormRadioRow, {
        label: "MyMemory",
        subLabel: "Alternativo com fallback",
        selected: plugin.storage.engine === "mymemory",
        onPress: function() {
            plugin.storage.engine = "mymemory";
        }
    }));
}const defaults = {
    targetLang: "pt",
    autoTranslate: true,
    showOriginal: true,
    translateSelf: false,
    ignoreBots: true,
    engine: "google"
};
for (const k of Object.keys(defaults)){
    if (plugin.storage[k] === undefined) plugin.storage[k] = defaults[k];
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
    return data[0].map(function(p) {
        return p[0];
    }).join("");
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
async function translateText(text) {
    const lang = String(plugin.storage.targetLang || "pt").toLowerCase();
    const key = cacheKey(text, lang);
    if (cache.has(key)) return cache.get(key);
    let out = "";
    if (plugin.storage.engine === "mymemory") {
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
    if (plugin.storage.ignoreBots && message.author && message.author.bot) return true;
    if (!plugin.storage.translateSelf && UserStore && message.author && UserStore.getCurrentUser && UserStore.getCurrentUser().id === message.author.id) return true;
    if (message.content.includes("\n\u200b\u200b")) return true;
    return false;
}
function applyTranslation(message, translated) {
    if (!translated || !translated.trim()) return;
    if (translated.trim().toLowerCase() === message.content.trim().toLowerCase()) return;
    message._ctOriginal = message.content;
    message._ctTranslated = translated;
    if (plugin.storage.showOriginal) {
        message.content = message._ctOriginal + "\n\u200b\u200b" + translated;
    } else {
        message.content = translated;
    }
    done.add(message.id);
}
async function handleMessage(channelId, message) {
    if (!plugin.storage.autoTranslate) return;
    if (!message) return;
    if (!UserStore) UserStore = metro.findByStoreName("UserStore");
    if (shouldSkip(message)) return;
    pending.add(message.id);
    try {
        const t = await translateText(message.content);
        applyTranslation(message, t);
        common.FluxDispatcher.dispatch({
            type: "MESSAGE_UPDATE",
            message: message
        });
    } catch (e) {
        toasts.showToast("Falha ao traduzir: " + String(e.message || e).slice(0, 80), {
            type: "error"
        });
    } finally{
        pending.delete(message.id);
    }
}
const patches = [];
function translateManually(message) {
    if (!message || typeof message.content !== "string") return Promise.resolve("");
    const src = message._ctOriginal || message.content.split("\n\u200b\u200b")[0];
    return translateText(src).then(function(t) {
        applyTranslation(message, t);
        common.FluxDispatcher.dispatch({
            type: "MESSAGE_UPDATE",
            message
        });
        return t;
    });
}
var index = {
    settings,
    onUnload () {
        for (const u of patches){
            try {
                u();
            } catch (e) {}
        }
        patches.length = 0;
        cache.clear();
        done.clear();
        pending.clear();
    },
    onLoad () {
        try {
            UserStore = metro.findByStoreName("UserStore");
            MessageStore = metro.findByStoreName("MessageStore");
            ChannelStore = metro.findByStoreName("ChannelStore");
        } catch (e) {}
        patches.push(patcher.before("dispatch", common.FluxDispatcher, function(args) {
            const ev = args[0];
            if (!ev || !ev.type) return args;
            if (ev.type === "MESSAGE_CREATE") {
                const m = ev.message;
                if (m && m.content) {
                    setTimeout(function() {
                        return handleMessage(m.channel_id || m.channelId, m);
                    }, 50);
                }
            }
            if (ev.type === "MESSAGE_UPDATE") {
                const m = ev.message;
                if (m && m.content && !m._ctTranslated && !done.has(m.id)) {
                    if (plugin.storage.autoTranslate) {
                        setTimeout(function() {
                            return handleMessage(m.channel_id || m.channelId, m);
                        }, 50);
                    }
                }
            }
            return args;
        }));
    }
};exports.default=index;exports.translateManually=translateManually;exports.translateText=translateText;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.plugin,vendetta.patcher,vendetta.metro,vendetta.metro.common,vendetta.ui.toasts,vendetta.storage,vendetta.ui.components);