import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

export default () => {
  useProxy(storage);
  return (
    <>
      <Forms.FormSwitchRow
        label="Ativado"
        subLabel="Pula a compressao do app ao enviar"
        value={storage.enabled !== false}
        onValueChange={(v) => { storage.enabled = v; }}
      />
      <Forms.FormRow
        label="Aviso"
        subLabel="Limite do servidor continua valendo, o app avisa se passar"
      />
    </>
  );
};
