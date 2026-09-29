(function(exports,plugin,patcher,metro,common,storage,components){'use strict';const SIZES = [
    "48",
    "96",
    "128",
    "256"
];
function settings() {
    storage.useProxy(plugin.storage);
    const cur = String(plugin.storage.emojiSize || 128);
    return /*#__PURE__*/ common.React.createElement(common.React.Fragment, null, /*#__PURE__*/ common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Forcar conversao",
        subLabel: "Converte mesmo tendo nitro",
        value: plugin.storage.forceMoji === true,
        onValueChange: function(v) {
            plugin.storage.forceMoji = v;
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Link com nome",
        subLabel: "Envia como nome clicavel em vez de link cru",
        value: plugin.storage.hyperlink !== false,
        onValueChange: function(v) {
            plugin.storage.hyperlink = v;
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormRow, {
        label: "Tamanho do emoji",
        subLabel: "Atual: " + cur
    }), SIZES.map(function(s) {
        return /*#__PURE__*/ common.React.createElement(components.Forms.FormRadioRow, {
            key: s,
            label: s + "px",
            selected: cur === s,
            onPress: function() {
                plugin.storage.emojiSize = Number(s);
            }
        });
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormRow, {
        label: "Aviso",
        subLabel: "Outros veem como imagem, perfeito em mensagem so com um emoji"
    }));
}if (plugin.storage.emojiSize === undefined) plugin.storage.emojiSize = 128;
if (typeof plugin.storage.emojiSize === "string") plugin.storage.emojiSize = parseInt(plugin.storage.emojiSize);
if (plugin.storage.hyperlink === undefined) plugin.storage.hyperlink = true;
if (plugin.storage.forceMoji === undefined) plugin.storage.forceMoji = false;
const patches = [];
const reAll = new RegExp("<a?:(\\w+):(\\d+)>", "gi");
const reAny = new RegExp("<a?:(\\w+):(\\d+)>", "i");
function haveNitro() {
    try {
        const UserStore = metro.findByStoreName("UserStore");
        const me = UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();
        return Boolean(me && me.premiumType && me.premiumType > 0);
    } catch (e) {
        return false;
    }
}
function currentGuild() {
    try {
        const S = metro.findByStoreName("SelectedGuildStore");
        return S && S.getGuildId && S.getGuildId();
    } catch (e) {
        return null;
    }
}
function lookupEmoji(id) {
    try {
        const E = metro.findByStoreName("EmojiStore");
        if (E && E.getCustomEmojiById) return E.getCustomEmojiById(id);
    } catch (e) {}
    return null;
}
function buildUrl(id, name, animated) {
    const size = Number(plugin.storage.emojiSize) || 128;
    let base = "https://cdn.discordapp.com/emojis/" + id + ".webp?size=" + size + "&quality=lossless&name=" + name;
    if (animated) base = base + "&animated=true";
    return base;
}
function convertText(text) {
    const gid = currentGuild();
    return String(text).replace(reAll, function(full, name, id) {
        const animated = full.charAt(1) === "a";
        const emoji = lookupEmoji(id);
        if (emoji) {
            const sameGuild = gid && String(emoji.guildId) === String(gid);
            if (sameGuild && !emoji.animated) return full;
        }
        const url = buildUrl(id, name, animated || emoji && emoji.animated);
        if (plugin.storage.hyperlink) return "[" + name + "](" + url + ")";
        return url;
    });
}
function processMsg(msg) {
    if (!msg || typeof msg.content !== "string") return;
    if (!reAny.test(msg.content)) return;
    if (!plugin.storage.forceMoji && haveNitro()) return;
    msg.content = convertText(msg.content).trim();
    msg.invalidEmojis = [];
}
function arm() {
    try {
        const nitroInfo = metro.findByProps("canUseEmojisEverywhere");
        if (nitroInfo) {
            patches.push(patcher.instead("canUseEmojisEverywhere", nitroInfo, function() {
                return true;
            }));
            try {
                patches.push(patcher.instead("canUseAnimatedEmojis", nitroInfo, function() {
                    return true;
                }));
            } catch (e) {}
        }
    } catch (e) {}
    try {
        const messageModule = metro.findByProps("sendMessage", "receiveMessage");
        if (messageModule) patches.push(patcher.before("sendMessage", messageModule, function(args) {
            return processMsg(args[1]);
        }));
    } catch (e) {}
    try {
        const uploadModule = metro.findByProps("uploadLocalFiles");
        if (uploadModule) patches.push(patcher.before("uploadLocalFiles", uploadModule, function(args) {
            if (args && args[0] && args[0].parsedMessage) processMsg(args[0].parsedMessage);
        }));
    } catch (e) {}
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
    },
    onLoad () {
        try {
            arm();
        } catch (e) {}
    }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.plugin,vendetta.patcher,vendetta.metro,vendetta.metro.common,vendetta.storage,vendetta.ui.components);