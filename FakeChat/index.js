(function(exports,plugin,patcher,metro,common,storage,components,toasts,assets,utils){'use strict';if (plugin.storage.enabled === undefined) plugin.storage.enabled = true;
const faked = new Map();
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
function openEditModal(message) {
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
    const alertId = "fakechat-edit-" + message.id;
    const EditBox = function() {
        const [text, setText] = common.React.useState(String(message.content || ""));
        return common.React.createElement(AlertModal, {
            title: "Editar mensagem",
            content: "So voce ve essa edicao",
            extraContent: common.React.createElement(common.ReactNative.TextInput, {
                value: text,
                onChangeText: setText,
                multiline: true,
                autoFocus: true,
                style: {
                    color: "#dbdee1",
                    backgroundColor: "#2b2d31",
                    borderRadius: 8,
                    padding: 10,
                    minHeight: 80,
                    textAlignVertical: "top"
                }
            }),
            actions: common.React.createElement(common.React.Fragment, null, common.React.createElement(AlertActionButton, {
                text: "Salvar",
                variant: "primary",
                onPress: function() {
                    const channelId = message.channel_id || message.channelId;
                    const next = String(text || "");
                    if (!faked.has(message.id) && !message._fakeOriginal) {
                        faked.set(message.id, String(message.content || ""));
                        message._fakeOriginal = String(message.content || "");
                    }
                    dismissAlert(alertId);
                    forceRefresh(channelId, message.id, next, message.embeds);
                    toasts.showToast("Mensagem editada (fake)");
                }
            }), common.React.createElement(AlertActionButton, {
                text: "Cancelar",
                variant: "secondary",
                onPress: function() {
                    return dismissAlert(alertId);
                }
            }))
        });
    };
    try {
        openAlert(alertId, common.React.createElement(EditBox, null));
    } catch (e) {
        toasts.showToast("Falha ao abrir editor", {
            type: "error"
        });
    }
}
function openImpersonateModal(message) {
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
    const origAuthor = message.author || {};
    const defaultName = String(origAuthor.username || origAuthor.globalName || "");
    const defaultText = "<@" + String(origAuthor.id || "") + "> ";
    const alertId = "fakechat-fingir-" + message.id + "-" + String(Date.now());
    const FakeBox = function() {
        const [nome, setNome] = common.React.useState(defaultName);
        const [texto, setTexto] = common.React.useState(defaultText);
        return common.React.createElement(AlertModal, {
            title: "Fingir mensagem",
            content: "Envia fake como essa pessoa, so local",
            extraContent: common.React.createElement(common.ReactNative.View, {
                style: {
                    gap: 8
                }
            }, common.React.createElement(common.ReactNative.TextInput, {
                value: nome,
                onChangeText: setNome,
                autoFocus: false,
                placeholder: "Nome a exibir",
                placeholderTextColor: "#87898c",
                style: {
                    color: "#dbdee1",
                    backgroundColor: "#2b2d31",
                    borderRadius: 8,
                    padding: 10,
                    minHeight: 44
                }
            }), common.React.createElement(common.ReactNative.TextInput, {
                value: texto,
                onChangeText: setTexto,
                multiline: true,
                autoFocus: true,
                placeholder: "Mensagem, use @ para mencionar",
                placeholderTextColor: "#87898c",
                style: {
                    color: "#dbdee1",
                    backgroundColor: "#2b2d31",
                    borderRadius: 8,
                    padding: 10,
                    minHeight: 80,
                    textAlignVertical: "top"
                }
            })),
            actions: common.React.createElement(common.React.Fragment, null, common.React.createElement(AlertActionButton, {
                text: "Enviar",
                variant: "primary",
                onPress: function() {
                    const Dispatcher = metro.findByProps("dispatch", "subscribe");
                    const channelId = message.channel_id || message.channelId;
                    const finalName = String(nome || "").trim() || defaultName || "Alguem";
                    const finalText = String(texto || "").trim();
                    if (!finalText) {
                        toasts.showToast("Mensagem vazia", {
                            type: "error"
                        });
                        return;
                    }
                    const fakeAuthor = Object.assign({}, origAuthor, {
                        username: finalName,
                        globalName: finalName
                    });
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
                        toasts.showToast("Fake enviado como " + finalName);
                    } catch (e) {
                        toasts.showToast("Falha ao enviar fake", {
                            type: "error"
                        });
                    }
                }
            }), common.React.createElement(AlertActionButton, {
                text: "Cancelar",
                variant: "secondary",
                onPress: function() {
                    return dismissAlert(alertId);
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
function restoreOriginal(message) {
    const Sheets = metro.findByProps("openLazy", "hideActionSheet");
    try {
        if (Sheets && Sheets.hideActionSheet) Sheets.hideActionSheet();
    } catch (e) {}
    const orig = message._fakeOriginal || faked.get(message.id);
    if (!orig) {
        toasts.showToast("Nada para restaurar", {
            type: "error"
        });
        return;
    }
    const channelId = message.channel_id || message.channelId;
    delete message._fakeOriginal;
    faked.delete(message.id);
    forceRefresh(channelId, message.id, orig, message.embeds);
    toasts.showToast("Original restaurado");
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
                        iconSrc = assets.getAssetIDByName("ic_message_edit_24px") || assets.getAssetIDByName("ic_edit_24px") || assets.getAssetIDByName("ic_chat_24px");
                    } catch (e) {}
                    const isFaked = Boolean(message._fakeOriginal || faked.has(message.id));
                    const editBtn = common.React.createElement(RowComp, {
                        label: "Editar fake",
                        icon: iconSrc ? common.React.createElement(RowComp.Icon, {
                            source: iconSrc
                        }) : null,
                        onPress: function() {
                            return openEditModal(message);
                        }
                    });
                    const undoBtn = common.React.createElement(RowComp, {
                        label: "Desfazer fake",
                        icon: iconSrc ? common.React.createElement(RowComp.Icon, {
                            source: iconSrc
                        }) : null,
                        onPress: function() {
                            return restoreOriginal(message);
                        }
                    });
                    const fingirBtn = common.React.createElement(RowComp, {
                        label: "Fingir como ele",
                        icon: iconSrc ? common.React.createElement(RowComp.Icon, {
                            source: iconSrc
                        }) : null,
                        onPress: function() {
                            return openImpersonateModal(message);
                        }
                    });
                    const toAdd = isFaked ? [
                        editBtn,
                        fingirBtn,
                        undoBtn
                    ] : [
                        editBtn,
                        fingirBtn
                    ];
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
                        for(let i = toAdd.length - 1; i >= 0; i--)kids.unshift(toAdd[i]);
                        inserted = true;
                        break;
                    }
                    if (!inserted) {
                        try {
                            groups.unshift(common.React.createElement(RowComp.Group, null, toAdd));
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
        subLabel: "Mostra opcoes fake ao segurar mensagem",
        value: plugin.storage.enabled !== false,
        onValueChange: function(v) {
            plugin.storage.enabled = v;
        }
    }), common.React.createElement(components.Forms.FormRow, {
        label: "Aviso",
        subLabel: "Edicao so local, ninguem mais ve"
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