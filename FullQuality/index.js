(function(exports,plugin,patcher,metro,common,storage,components){'use strict';function settings() {
    storage.useProxy(plugin.storage);
    return /*#__PURE__*/ common.React.createElement(common.React.Fragment, null, /*#__PURE__*/ common.React.createElement(components.Forms.FormSwitchRow, {
        label: "Ativado",
        subLabel: "Pula a compressao do app ao enviar",
        value: plugin.storage.enabled !== false,
        onValueChange: function(v) {
            plugin.storage.enabled = v;
        }
    }), /*#__PURE__*/ common.React.createElement(components.Forms.FormRow, {
        label: "Aviso",
        subLabel: "Limite do servidor continua valendo, o app avisa se passar"
    }));
}if (plugin.storage.enabled === undefined) plugin.storage.enabled = true;
const patches = [];
function arm() {
    let CU = null;
    try {
        const mod = metro.findByProps("CloudUpload");
        CU = mod && mod.CloudUpload;
    } catch (e) {}
    if (!CU || !CU.prototype) return false;
    patches.push(patcher.after("reactNativeCompressAndExtractData", CU.prototype, function(args, res) {
        if (plugin.storage.enabled === false) return res;
        const media = this;
        return new Promise(function(resolve) {
            media.reactNativeFilePrepped = true;
            if (media.preCompressionSize) {
                media.currentSize = media.preCompressionSize;
                media.postCompressionSize = media.preCompressionSize;
            } else {
                media.postCompressionSize = 1000;
                media.preCompressionSize = 1000;
                media.currentSize = 1000;
            }
            const mt = String(media.mimeType || "");
            const fn = String(media.filename || "");
            if (mt === "image/png" && !fn.toLowerCase().endsWith(".png")) media.filename = fn + ".png";
            if ((mt === "image/jpeg" || mt === "image/jpg") && !(fn.toLowerCase().endsWith(".jpg") || fn.toLowerCase().endsWith(".jpeg"))) media.filename = fn + ".jpg";
            resolve(media);
        });
    }));
    patches.push(patcher.before("handleError", CU.prototype, function(args) {
        if (plugin.storage.enabled === false) return;
        if (args && args[0] === 40005) {
            try {
                const Dialog = metro.findByProps("show", "confirm", "close");
                Dialog.show({
                    title: "Arquivo muito pesado",
                    body: "O servidor recusou, passa do limite da sua conta",
                    confirmText: "Entendi",
                    confirmColor: "brand"
                });
            } catch (e) {}
        }
    }));
    return true;
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