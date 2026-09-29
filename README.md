# discord-chat-translator

Plugin Vendetta / Vencord para traduzir o chat do Discord automaticamente.

## Instalar

1. Copie o link do plugin:
```
https://trickhook.github.io/discord-chat-translator/ChatTranslator
```
2. No Discord com Vendetta, abra Ajustes > Plugins > pressione `+`
3. Cole o link e confirme
4. Ajuste o idioma em Ajustes > Plugins > ChatTranslator > Configurações

Ou instalação manual: copie `plugins/ChatTranslator` para a pasta de plugins.

## Uso

- Tradução automática de mensagens novas
- Mantém original + tradução
- Troca de idioma destino (pt, en, es, fr, de, it, ja, ko, zh-CN, ru ou personalizado)
- Engines: Google (padrão) com fallback MyMemory

## Estrutura

```
plugins/ChatTranslator/
  manifest.json
  index.js
  settings.jsx
```
