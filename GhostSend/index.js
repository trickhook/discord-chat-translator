(function(exports,plugin,patcher,metro,common,storage,components,toasts,assets,utils){'use strict';if (plugin.storage.enabled === undefined) plugin.storage.enabled = true;
if (plugin.storage.secs === undefined) plugin.storage.secs = 10;
const timers = new Map();
const patches = [];
function isOwn(message) {
    try {
        const UserStore = metro.findByStoreName("UserStore");
        const me = UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();
        return Boolean(me && message && message.author && String(me.id) === String(message.author.id));
    } catch (e) {
        return false;
    }
}
function localDelete(channelId, messageId) {
    try {
        const Dispatcher = metro.findByProps("dispatch", "subscribe");
        Dispatcher.dispatch({
            type: "MESSAGE_DELETE",
            channelId: channelId,
            id: messageId
        });
    } catch (e) {}
}
function fireDelete(message) {
    const channelId = message.channel_id || message.channelId;
    const messageId = message.id;
    try {
        const api = metro.findByProps("deleteMessage");
        if (api && api.deleteMessage) {
            Promise.resolve(api.deleteMessage(channelId, messageId)).catch(function() {
                return localDelete(channelId, messageId);
            });
        } else {
            localDelete(channelId, messageId);
        }
    } catch (e) {
        localDelete(channelId, messageId);
    }
    timers.delete(messageId);
    toasts.showToast("Mensagem fantasma apagada");
}
function armGhost(message) {
    const Sheets = metro.findByProps("openLazy", "hideActionSheet");
    try {
        if (Sheets && Sheets.hideActionSheet) Sheets.hideActionSheet();
    } catch (e) {}
    const secs = Number(plugin.storage.secs) || 10;
    if (timers.has(message.id)) {
        try {
            clearTimeout(timers.get(message.id));
        } catch (e) {}
        timers.delete(message.id);
        toasts.showToast("Fantasma cancelado");
        return;
    }
    const t = setTimeout(function() {
        return fireDelete(message);
    }, secs * 1000);
    timers.set(message.id, t);
    toasts.showToast("Apaga em " + String(secs) + "s");
}
function patchMenu() {
    let ActionSheet = null;
    let RowComp = null;
    try {
        ActionSheet = metro.findByProps("openLazy", "hideActionSheet");
        const found = metro.findByProps("ActionSheetRow");
        RowComp = found && found.ActionSheetRow || null;
    } catch (e) {}
    if (!ActionSheet || !RowComp) return null;
    return patcher.before("openLazy", ActionSheet, function([comp, args, msg]) {
        if (plugin.storage.enabled === false) return;
        if (args !== "MessageLongPressActionSheet") return;
        if (!msg || !msg.message) return;
        const message = msg.message;
        if (!isOwn(message)) return;
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
                        iconSrc = assets.getAssetIDByName("ic_hide_24px") || assets.getAssetIDByName("ic_chat_24px");
                    } catch (e) {}
                    const armed = timers.has(message.id);
                    const btn = common.React.createElement(RowComp, {
                        label: armed ? "Cancelar fantasma" : "Fantasma " + String(Number(plugin.storage.secs) || 10) + "s",
                        icon: iconSrc ? common.React.createElement(RowComp.Icon, {
                            source: iconSrc
                        }) : null,
                        onPress: function() {
                            return armGhost(message);
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
                            groups.unshift(common.React.createElement(RowComp.Group, null, [
                                btn
                            ]));
                        } catch (e) {}
                    }
                });
            });
        } catch (e) {}
    });
}
function Settings() {
    storage.useProxy(plugin.storage);
    const secs = String(plugin.storage.secs || 10);
    return common.React.createElement(common.React.Fragment, null, common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Ativado",
        subLabel: "Mostra Fantasma ao segurar sua mensagem",
        value: plugin.storage.enabled !== false,
        onValueChange: function(v) {
            plugin.storage.enabled = v;
        }
    }), common.React.createElement(components.Forms.FormRow, {
        label: "Tempo",
        subLabel: "Atual: " + secs + "s"
    }), [
        "5",
        "10",
        "30",
        "60"
    ].map(function(s) {
        return common.React.createElement(components.Forms.FormRadioRow, {
            key: s,
            label: s + " segundos",
            selected: secs === s,
            onPress: function() {
                plugin.storage.secs = Number(s);
            }
        });
    }), common.React.createElement(components.Forms.FormRow, {
        label: "Aviso",
        subLabel: "Apaga de verdade via API, some para todos"
    }));
}
var index = {
    settings: Settings,
    onUnload () {
        for (const u of patches){
            try {
                u();
            } catch (e) {}
        }
        patches.length = 0;
        for (const t of timers.values()){
            try {
                clearTimeout(t);
            } catch (e) {}
        }
        timers.clear();
    },
    onLoad () {
        try {
            const u = patchMenu();
            if (u) patches.push(u);
        } catch (e) {}
    }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.plugin,vendetta.patcher,vendetta.metro,vendetta.metro.common,vendetta.storage,vendetta.ui.components,vendetta.ui.toasts,vendetta.ui.assets,vendetta.utils);