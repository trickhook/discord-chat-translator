(function(exports,plugin,patcher,metro,common,toasts,alerts,assets,utils,storage,components){'use strict';const LANGS = [
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
        subLabel: "Desligado = segure a mensagem e use Traduzir",
        value: plugin.storage.autoTranslate === true,
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
    autoTranslate: false,
    showOriginal: true,
    translateSelf: true,
    ignoreBots: true,
    engine: "google"
};
for (const k of Object.keys(defaults)){
    if (plugin.storage[k] === undefined) plugin.storage[k] = defaults[k];
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
function cleanSource(input) {
    const raw = typeof input === "string" ? input : input && input.content || "";
    return String(raw).split("\n\u200b\u200b")[0].trim();
}
function sleep(ms) {
    return new Promise(function(r) {
        return setTimeout(r, ms);
    });
}
async function forceRefresh(channelId, messageId, content, embeds) {
    const Dispatcher = metro.findByProps("dispatch", "subscribe");
    if (!Dispatcher || !channelId || !messageId) return;
    Dispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: {
            id: messageId,
            channel_id: channelId,
            content: content + " ",
            embeds: embeds || []
        }
    });
    await sleep(60);
    Dispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: {
            id: messageId,
            channel_id: channelId,
            content: content,
            embeds: embeds || []
        }
    });
}
function applyToChat(message, translated) {
    const src = cleanSource(message);
    if (!translated || !translated.trim()) return;
    const channelId = message.channel_id || message.channelId;
    const final = plugin.storage.showOriginal ? src + "\n\u200b\u200b" + translated : translated;
    done.add(message.id);
    forceRefresh(channelId, message.id, final, message.embeds);
}
function runManualTranslate(message) {
    const ActionSheet = metro.findByProps("openLazy", "hideActionSheet");
    try {
        if (ActionSheet && ActionSheet.hideActionSheet) ActionSheet.hideActionSheet();
    } catch (e) {}
    const src = cleanSource(message);
    if (!src) {
        toasts.showToast("Mensagem vazia", {
            type: "error"
        });
        return;
    }
    toasts.showToast("Traduzindo...", {
        type: "open"
    });
    translateText(src).then(function(t) {
        alerts.showConfirmationAlert({
            title: "Traducao",
            content: t,
            confirmText: "Aplicar no chat",
            cancelText: "Fechar",
            onConfirm: function() {
                return applyToChat(message, t);
            }
        });
    }).catch(function(e) {
        toasts.showToast("Falha ao traduzir: " + String(e && e.message || e).slice(0, 80), {
            type: "error"
        });
    });
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
async function handleMessage(message) {
    if (!plugin.storage.autoTranslate) return;
    if (!message) return;
    if (!UserStore) {
        try {
            UserStore = metro.findByStoreName("UserStore");
        } catch (e) {}
    }
    if (shouldSkip(message)) return;
    pending.add(message.id);
    try {
        const t = await translateText(cleanSource(message));
        applyToChat(message, t);
    } catch (e) {
        toasts.showToast("Falha ao traduzir: " + String(e && e.message || e).slice(0, 80), {
            type: "error"
        });
    } finally{
        pending.delete(message.id);
    }
}
let sheetUnpatch = null;
function patchMessageMenu() {
    let ActionSheet = null;
    let RowComp = null;
    try {
        ActionSheet = metro.findByProps("openLazy", "hideActionSheet");
        const found = metro.findByProps("ActionSheetRow");
        RowComp = found && found.ActionSheetRow || null;
    } catch (e) {}
    if (!ActionSheet || !RowComp) return null;
    return patcher.before("openLazy", ActionSheet, function([comp, args, msg]) {
        if (args !== "MessageLongPressActionSheet") return;
        if (!msg || !msg.message) return;
        const message = msg.message;
        if (!message.content || !String(message.content).trim()) return;
        try {
            comp.then(function(instance) {
                const unpatch = patcher.after("default", instance, function(_a, component) {
                    common.React.useEffect(function() {
                        return function() {
                            try {
                                unpatch();
                            } catch (e) {}
                        };
                    }, []);
                    let groups = null;
                    try {
                        groups = utils.findInReactTree(component, function(c) {
                            return Array.isArray(c) && c[0] && c[0].type && c[0].type.name === "ActionSheetRowGroup";
                        });
                    } catch (e) {}
                    if (!groups || !groups.length) return;
                    let iconSrc = null;
                    try {
                        iconSrc = assets.getAssetIDByName("ic_translate_24px") || assets.getAssetIDByName("ic_chat_24px");
                    } catch (e) {}
                    const btn = common.React.createElement(RowComp, {
                        label: "Traduzir",
                        icon: iconSrc ? common.React.createElement(RowComp.Icon, {
                            source: iconSrc
                        }) : null,
                        onPress: function() {
                            return runManualTranslate(message);
                        }
                    });
                    let inserted = false;
                    for(let gi = 0; gi < groups.length; gi++){
                        let kids = null;
                        try {
                            kids = utils.findInReactTree(groups[gi], function(c) {
                                return Array.isArray(c) && c.some(function(ch) {
                                    return ch && ch.type && ch.type.name === "ActionSheetRow";
                                });
                            });
                        } catch (e) {}
                        if (!kids) continue;
                        kids.unshift(btn);
                        inserted = true;
                        break;
                    }
                    if (!inserted) {
                        try {
                            groups.unshift(common.React.createElement(RowComp.Group, null, btn));
                        } catch (e) {}
                    }
                });
            });
        } catch (e) {}
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
        try {
            if (sheetUnpatch) sheetUnpatch();
        } catch (e) {}
        sheetUnpatch = null;
        cache.clear();
        done.clear();
        pending.clear();
    },
    onLoad () {
        try {
            UserStore = metro.findByStoreName("UserStore");
        } catch (e) {}
        try {
            sheetUnpatch = patchMessageMenu();
            if (sheetUnpatch) patches.push(sheetUnpatch);
        } catch (e) {}
        patches.push(patcher.before("dispatch", common.FluxDispatcher, function(args) {
            const ev = args[0];
            if (!ev || !ev.type) return args;
            if (ev.type === "MESSAGE_CREATE") {
                const m = ev.message;
                if (m && m.content && plugin.storage.autoTranslate) setTimeout(function() {
                    return handleMessage(m);
                }, 80);
            }
            return args;
        }));
    }
};exports.default=index;exports.translateText=translateText;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.plugin,vendetta.patcher,vendetta.metro,vendetta.metro.common,vendetta.ui.toasts,vendetta.ui.alerts,vendetta.ui.assets,vendetta.utils,vendetta.storage,vendetta.ui.components);