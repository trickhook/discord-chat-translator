(function(exports,plugin,patcher,metro,common,storage,components,toasts,assets,utils){'use strict';if (plugin.storage.enabled === undefined) plugin.storage.enabled = true;
const patches = [];
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
function openEmbedModal(message) {
    const Sheets = metro.findByProps("openLazy", "hideActionSheet");
    try {
        if (Sheets && Sheets.hideActionSheet) Sheets.hideActionSheet();
    } catch (e) {}
    let alertKit = null;
    let modalKit = null;
    try {
        alertKit = metro.findByProps("openAlert", "dismissAlert");
        modalKit = metro.findByProps("AlertModal", "AlertActions");
    } catch (e) {}
    if (!alertKit || !modalKit || !modalKit.AlertModal) {
        toasts.showToast("Alertas indisponiveis neste client", {
            type: "error"
        });
        return;
    }
    const { openAlert, dismissAlert } = alertKit;
    const { AlertModal, AlertActionButton } = modalKit;
    const alertId = "embedfake-" + message.id + "-" + String(Date.now());
    const FakeBox = function() {
        const [titulo, setTitulo] = common.React.useState("Noticia urgente");
        const [desc, setDesc] = common.React.useState("Clique para ver");
        const [link, setLink] = common.React.useState("https://discord.com/");
        const [imagem, setImagem] = common.React.useState("");
        const field = function(val, set, ph) {
            return common.React.createElement(common.ReactNative.TextInput, {
                value: val,
                onChangeText: set,
                placeholder: ph,
                placeholderTextColor: "#87898c",
                style: {
                    color: "#dbdee1",
                    backgroundColor: "#2b2d31",
                    borderRadius: 8,
                    padding: 10,
                    minHeight: 44
                }
            });
        };
        return common.React.createElement(AlertModal, {
            title: "Embed fake",
            content: "Preview falso so local",
            extraContent: common.React.createElement(common.ReactNative.View, {
                style: {
                    gap: 8
                }
            }, field(titulo, setTitulo, "Titulo"), field(desc, setDesc, "Descricao"), field(link, setLink, "Link https://..."), field(imagem, setImagem, "Imagem https://... (opcional)")),
            actions: common.React.createElement(common.React.Fragment, null, common.React.createElement(AlertActionButton, {
                text: "Aplicar",
                variant: "primary",
                onPress: function() {
                    const channelId = message.channel_id || message.channelId;
                    const t = String(titulo || "").trim() || "Link";
                    const d = String(desc || "").trim();
                    const u = String(link || "").trim() || "https://discord.com/";
                    const img = String(imagem || "").trim();
                    const embed = {
                        type: "rich",
                        title: t,
                        description: d,
                        url: u,
                        color: 5814783
                    };
                    if (img) embed.image = {
                        url: img
                    };
                    if (img) embed.thumbnail = {
                        url: img
                    };
                    const embeds = [].concat(message.embeds || [], [
                        embed
                    ]);
                    dismissAlert(alertId);
                    forceRefresh(channelId, message.id, String(message.content || ""), embeds);
                    toasts.showToast("Embed fake aplicado");
                }
            }), common.React.createElement(AlertActionButton, {
                text: "Limpar",
                variant: "secondary",
                onPress: function() {
                    const channelId = message.channel_id || message.channelId;
                    dismissAlert(alertId);
                    forceRefresh(channelId, message.id, String(message.content || ""), []);
                    toasts.showToast("Embeds removidos");
                }
            }))
        });
    };
    try {
        openAlert(alertId, common.React.createElement(FakeBox, null));
    } catch (e) {
        toasts.showToast("Falha ao abrir editor", {
            type: "error"
        });
    }
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
        if (typeof message.content !== "string") return;
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
                        iconSrc = assets.getAssetIDByName("ic_link_24px") || assets.getAssetIDByName("ic_chat_24px");
                    } catch (e) {}
                    const btn = common.React.createElement(RowComp, {
                        label: "Embed fake",
                        icon: iconSrc ? common.React.createElement(RowComp.Icon, {
                            source: iconSrc
                        }) : null,
                        onPress: function() {
                            return openEmbedModal(message);
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
    return common.React.createElement(common.React.Fragment, null, common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Ativado",
        subLabel: "Mostra Embed fake ao segurar mensagem",
        value: plugin.storage.enabled !== false,
        onValueChange: function(v) {
            plugin.storage.enabled = v;
        }
    }), common.React.createElement(components.Forms.FormRow, {
        label: "Aviso",
        subLabel: "Preview so local, ninguem mais ve"
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
    },
    onLoad () {
        try {
            const u = patchMenu();
            if (u) patches.push(u);
        } catch (e) {}
    }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.plugin,vendetta.patcher,vendetta.metro,vendetta.metro.common,vendetta.storage,vendetta.ui.components,vendetta.ui.toasts,vendetta.ui.assets,vendetta.utils);