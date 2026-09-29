import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

const LANGS = [
  { label: "Portugues", value: "pt" },
  { label: "English", value: "en" },
  { label: "Espanol", value: "es" },
  { label: "Francais", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Italiano", value: "it" },
  { label: "Japones", value: "ja" },
  { label: "Coreano", value: "ko" },
  { label: "Chines", value: "zh-CN" },
  { label: "Russo", value: "ru" }
];

export default () => {
  useProxy(storage);
  const [lang, setLang] = React.useState(storage.targetLang || "pt");
  const [custom, setCustom] = React.useState(storage.targetLang || "pt");

  function setTarget(v) {
    const nv = String(v || "").trim().toLowerCase() || "pt";
    storage.targetLang = nv;
    setLang(nv);
    setCustom(nv);
  }

  return (
    <>
      <Forms.FormSwitchRow
        label="Traducao automatica"
        subLabel="Desligado = segure a mensagem e use Traduzir"
        value={storage.autoTranslate === true}
        onValueChange={(v) => { storage.autoTranslate = v; }}
      />
      <Forms.FormSwitchRow
        label="Mostrar original"
        subLabel="Exibe o texto original junto com a traducao"
        value={storage.showOriginal !== false}
        onValueChange={(v) => { storage.showOriginal = v; }}
      />
      <Forms.FormSwitchRow
        label="Traduzir proprias mensagens"
        subLabel="Inclui mensagens enviadas por voce"
        value={storage.translateSelf === true}
        onValueChange={(v) => { storage.translateSelf = v; }}
      />
      <Forms.FormSwitchRow
        label="Ignorar bots"
        subLabel="Nao traduz mensagens de bots"
        value={storage.ignoreBots !== false}
        onValueChange={(v) => { storage.ignoreBots = v; }}
      />
      <Forms.FormRow
        label="Idioma destino"
        subLabel={"Atual: " + String(storage.targetLang || "pt")}
      />
      {LANGS.map((l) => (
        <Forms.FormRadioRow
          key={l.value}
          label={l.label}
          subLabel={l.value}
          selected={String(storage.targetLang || "pt").toLowerCase() === l.value}
          onPress={() => setTarget(l.value)}
        />
      ))}
      <Forms.FormInput
        title="Idioma personalizado"
        placeholder="ex: pt, en, es, fr"
        value={custom}
        onChange={(v) => setCustom(v)}
        onBlur={() => {
          if (custom && custom.trim()) setTarget(custom);
        }}
      />
      <Forms.FormRow
        label="Engine"
        subLabel={storage.engine === "mymemory" ? "MyMemory" : "Google"}
      />
      <Forms.FormRadioRow
        label="Google"
        subLabel="Rapido e gratis"
        selected={storage.engine !== "mymemory"}
        onPress={() => { storage.engine = "google"; }}
      />
      <Forms.FormRadioRow
        label="MyMemory"
        subLabel="Alternativo com fallback"
        selected={storage.engine === "mymemory"}
        onPress={() => { storage.engine = "mymemory"; }}
      />
    </>
  );
};
