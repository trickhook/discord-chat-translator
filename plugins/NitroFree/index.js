import { storage } from "@vendetta/plugin";
import { before as patchBefore, instead as patchInstead } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";
import settings from "./settings.jsx";

if (storage.emojiSize === undefined) storage.emojiSize = 128;
if (typeof storage.emojiSize === "string") storage.emojiSize = parseInt(storage.emojiSize);
if (storage.hyperlink === undefined) storage.hyperlink = true;
if (storage.forceMoji === undefined) storage.forceMoji = false;

const patches = [];
const reAll = new RegExp("<a?:(\\w+):(\\d+)>", "gi");
const reAny = new RegExp("<a?:(\\w+):(\\d+)>", "i");

function haveNitro() {
  try {
    const UserStore = findByStoreName("UserStore");
    const me = UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();
    return Boolean(me && me.premiumType && me.premiumType > 0);
  } catch (e) {
    return false;
  }
}

function currentGuild() {
  try {
    const S = findByStoreName("SelectedGuildStore");
    return S && S.getGuildId && S.getGuildId();
  } catch (e) {
    return null;
  }
}

function lookupEmoji(id) {
  try {
    const E = findByStoreName("EmojiStore");
    if (E && E.getCustomEmojiById) return E.getCustomEmojiById(id);
  } catch (e) {}
  return null;
}

function buildUrl(id, name, animated) {
  const size = Number(storage.emojiSize) || 128;
  let base = "https://cdn.discordapp.com/emojis/" + id + ".webp?size=" + size + "&quality=lossless&name=" + name;
  if (animated) base = base + "&animated=true";
  return base;
}

function convertText(text) {
  const gid = currentGuild();
  return String(text).replace(reAll, (full, name, id) => {
    const animated = full.charAt(1) === "a";
    const emoji = lookupEmoji(id);
    if (emoji) {
      const sameGuild = gid && String(emoji.guildId) === String(gid);
      if (sameGuild && !emoji.animated) return full;
    }
    const url = buildUrl(id, name, animated || (emoji && emoji.animated));
    if (storage.hyperlink) return "[" + name + "](" + url + ")";
    return url;
  });
}

function processMsg(msg) {
  if (!msg || typeof msg.content !== "string") return;
  if (!reAny.test(msg.content)) return;
  if (!storage.forceMoji && haveNitro()) return;
  msg.content = convertText(msg.content).trim();
  msg.invalidEmojis = [];
}

function arm() {
  try {
    const nitroInfo = findByProps("canUseEmojisEverywhere");
    if (nitroInfo) {
      patches.push(patchInstead("canUseEmojisEverywhere", nitroInfo, () => true));
      try {
        patches.push(patchInstead("canUseAnimatedEmojis", nitroInfo, () => true));
      } catch (e) {}
    }
  } catch (e) {}
  try {
    const messageModule = findByProps("sendMessage", "receiveMessage");
    if (messageModule) patches.push(patchBefore("sendMessage", messageModule, (args) => processMsg(args[1])));
  } catch (e) {}
  try {
    const uploadModule = findByProps("uploadLocalFiles");
    if (uploadModule) patches.push(patchBefore("uploadLocalFiles", uploadModule, (args) => {
      if (args && args[0] && args[0].parsedMessage) processMsg(args[0].parsedMessage);
    }));
  } catch (e) {}
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
