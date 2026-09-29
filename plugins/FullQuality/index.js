import { storage } from "@vendetta/plugin";
import { before as patchBefore, after as patchAfter } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import settings from "./settings.jsx";

if (storage.enabled === undefined) storage.enabled = true;

const patches = [];

function arm() {
  let CU = null;
  try {
    const mod = findByProps("CloudUpload");
    CU = mod && mod.CloudUpload;
  } catch (e) {}
  if (!CU || !CU.prototype) return false;
  patches.push(patchAfter("reactNativeCompressAndExtractData", CU.prototype, function (args, res) {
    if (storage.enabled === false) return res;
    const media = this;
    return new Promise((resolve) => {
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
  patches.push(patchBefore("handleError", CU.prototype, function (args) {
    if (storage.enabled === false) return;
    if (args && args[0] === 40005) {
      try {
        const Dialog = findByProps("show", "confirm", "close");
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

export default {
  settings,
  onUnload() {
    for (const u of patches) {
      try {
        u();
      } catch (e) {}
    }
    patches.length = 0;
  },
  onLoad() {
    try {
      arm();
    } catch (e) {}
  }
};
