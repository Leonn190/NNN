# NNN — Finais cinematográficos (20/11/2026)

## Créditos finais com relógio da música

- **Duração:** a sequência encerra em \`audio.onended\`, exatamente quando termina \`public/audio/ending/creditos.mp3\`. O arquivo atual tem **199,920 segundos**, confirmados pela inspeção dos frames MPEG em CI. O roteiro-base é de 200 s, com interpolação dos tempos caso o arquivo tenha duração diferente.
- **Últimos sete segundos:** sem créditos; permanece apenas \`restaurante-vazio.png\`, com afastamento progressivo e escurecimento da imagem. O palco vazio, antes segunda cena, agora é a **última**.
- **Campo de visão:** as duas cinemáticas (créditos e morte dos guardas) usam a mesma largura máxima de 16:9 de \`.game\` (\`max-width:177.777778dvh\`), centralizadas, sem expor bordas adicionais em ultrawide.
- **Sincronização:** as 24 cartelas usam marcas de tempo de frases musicais. Em vez de temporizadores independentes, o tempo é lido diretamente de \`audio.currentTime\`, permitindo retomar a sincronia depois de pausas e mudanças de aba. Cada imagem tem duração individual e dissolve para a próxima em 0,85 s. Quando o navegador permite \`captureStream\` e Web Audio, os cortes aguardam no máximo 0,48 s para coincidir com um pulso forte próximo à marca; se indisponível, seguem as marcas de tempo da faixa, sem atrasos.
- **Texto:** apenas o título na abertura, sem atribuição a Leon Soto; funções principais condensadas nas próximas cenas.
- **Guardas:** 12 nomes em **seis aparições**, distribuídos em imagens diferentes, sempre com o título **INSPIRAÇÃO PARA OS SEGURANÇAS**, sem numeração.
- **Nathali Thomazine:** inspiração para Nathzinha, inspiração artística e agradecimento especial.
- **Música e efeitos:** mantêm-se créditos individuais aos criadores das canções e referência explícita aos sons de FNAF / Scott Cawthon. Reconhecimento de autoria não representa licença de reprodução.
- **Ferramentas:** ChatGPT (GPT), OpenAI Codex, HTML, CSS, JavaScript, GitHub e GitHub Pages.
- **Compatibilidade:** o botão de pular e Escape ainda fecham a cena e retornam à vitória/Extras. No erro de áudio, os créditos retornam em 5 segundos, sem 200 segundos de silêncio. Redução de movimento respeitada por CSS.

### Ordem das cenas (referência de 200 s)

| Entrada | Imagem | Movimento |
|---|---|---|
| 0:00 | creditos.png | Flutuação do título |
| 0:09 | recepcao.png | Travelling à esquerda |
| 0:25 | vip-bonecas.png | Travelling à direita |
| 0:41 | gotica-vip-roxo.png | Afastamento |
| 0:57 | maid-gatinha-cozinha.png | Subida |
| 1:13 | maid-oficina.png | Aproximação |
| 1:29 | fliperama.png | Travelling à direita |
| 1:45 | yandere-corredor-leste.png | Travelling à esquerda |
| 2:01 | palhaca-escritorio.png | Aproximação |
| 2:17 | corredor-bonecas.png | Subida |
| 2:33 | lounge-rosa-roxo.png | Afastamento |
| 2:57 | restaurante-vazio.png | Afastamento até o fim |
| 3:12,92–3:19,92 | Apenas palco vazio | Textos somem e a cena escurece |

A última cena permanece **até o fim real do MP3**, mesmo que o final mude de duração. Os tempos listados são âncoras de edição, não uma transcrição de letras.

## 12ª morte

A versão anterior foi preservada: mesmo áudio, panorama mais rápido (cerca de 20%), 10% de zoom adicional e mensagem centralizada e revisada. A moldura 16:9 agora se aplica à morte também.

## Verificação

\`\`\`sh
node scripts/sync-local-config.cjs --check
node scripts/package-pages.cjs
node scripts/check-assets.cjs dist
node --test tests/balance.cjs tests/image-cache.cjs tests/sound.cjs tests/notes.cjs tests/campaigns.cjs tests/endings.cjs
\`\`\`
