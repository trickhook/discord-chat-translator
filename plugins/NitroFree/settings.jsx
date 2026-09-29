import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

const SIZES = ["48", "96", "128", "256"];

export default () => {
  useProxy(storage);
  const cur = String(storage.emojiSize || 128);
  return (
    <>
      <Forms.FormSwitchRow
        label="Forcar conversao"
        subLabel="Converte mesmo tendo nitro"
        value={storage.forceMoji === true}
        onValueChange={(v) => { storage.forceMoji = v; }}
      />
      <Forms.FormSwitchRow
        label="Link com nome"
        subLabel="Envia como nome clicavel em vez de link cru"
        value={storage.hyperlink !== false}
        onValueChange={(v) => { storage.hyperlink = v; }}
      />
      <Forms.FormRow
        label="Tamanho do emoji"
        subLabel={"Atual: " + cur}
      />
      {SIZES.map((s) => (
        <Forms.FormRadioRow
          key={s}
          label={s + "px"}
          selected={cur === s}
          onPress={() => { storage.emojiSize = Number(s); }}
        />
      ))}
      <Forms.FormRow
        label="Aviso"
        subLabel="Outros veem como imagem, perfeito em mensagem so com um emoji"
      />
    </>
  );
};
