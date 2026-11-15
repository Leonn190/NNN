# Assets do NNN

Use nomes descritivos em minúsculas, sem espaços ou acentos e com hífens entre palavras. Preserve a extensão original ao mover arquivos. Os caminhos existentes com IDs `CAM01` a `CAM12`, IDs de portões e sufixos de composição como `+ambiente` fazem parte dos catálogos do jogo. Na simulação, `padrao` e `gatinha` correspondem aos IDs de arte `original` e `platinada`.

| Recurso | Destino e referência |
|---|---|
| Som | Organize em `public/audio/` pelo uso. Declare os efeitos configuráveis em `config/effects.json` com caminho relativo a `public/`. Registre amostras fixas em `src/sound.js` e faixas em `config/controls.json` na ordem de seleção desejada. |
| Imagem de personagem | Guarde a arte usada em cena na categoria correspondente de `public/images/`, como `office/characters/`. Registre a pose no catálogo ou no seletor de cena. Confira as variantes de armário, porta e corredor que a pose afeta. |
| Imagem de câmera | Use `public/images/cameras/CAMxx/` e atualize `src/data/game-data.js` para fundos, plantas técnicas e estados. Use os nomes e a ordem dos portões já registrados para cada câmera. |
| Pose gerada | Coloque a fonte na área correspondente de `outros/arte/` e ajuste o exportador. Versione o recorte e o catálogo gerados juntos. Confira a composição com os testes Python. |
| Jumpscare | Coloque a animação em `public/images/jumpscares/` e o áudio em `public/audio/jumpscares/`. Os jumpscares padrão usam o `artId` da personagem. O especial de câmera da Yandere usa as referências de `config/threats.json`. |
| Arte-fonte ou referência | Use `outros/arte/` por cenário ou personagem. A reserva histórica em `reserva/` guarda estados e composições que servem de referência para scripts e testes. Mantenha os mestres e as cópias de produção que tenham função própria. |
| Referências da planta | Arquivos consultados apenas na produção ficam em `outros/planta/referencias/`, ao lado da fonte técnica. Se não são lidos pelo jogo, não devem ficar em `public/reference/`. |
| Arte original de jumpscare | Guarde fontes e versões históricas em `outros/arte/jumpscares/`; a animação carregada pela página continua em `public/images/jumpscares/`. |
| Modelos 3D futuros | Documentação em `docs/modelos-3d.md`. Só crie `public/models/` quando houver um recurso 3D utilizado pelo jogo. |

Após editar `config/`, rode `node scripts/sync-local-config.cjs`. Use caminhos relativos ao site para funcionar tanto em uma subpasta do GitHub Pages quanto via `file://`.

`scripts/pages-files.cjs` define os formatos e diretórios publicados e inclui as referências dos JSONs. Atualize a seleção quando um novo recurso de runtime referenciado diretamente estiver fora dessas regras. Para um novo padrão de URL construído pelo código, acrescente uma verificação direcionada em `scripts/check-assets.cjs`. Ao mover um caminho, registre o endereço antigo em `scripts/legacy-asset-paths.json`. Gere o pacote com `node scripts/package-pages.cjs` e confira a seleção efetiva com `node scripts/check-assets.cjs dist`.

## Critérios para mover ou renomear

- Antes de mudar o caminho de uma imagem ou som usado pelo jogo, atualize o catálogo, JSON, HTML ou código que a carrega. Para arquivos de produção, atualize também exportadores e testes. Mover um arquivo não deve alterar seu conteúdo.
- Não mova os PNGs `master.png` e as referências de `reserva/` sem conferir os scripts que leem essas imagens; sua ausência da publicação no Pages não significa que sejam descartáveis.
- O manifesto `outros/documentacao/MAPEAMENTO_ORIGINAIS.json` registra caminhos **históricos** (`destino_v1`). Não substitua esses valores por caminhos novos: isso perderia a rastreabilidade do ZIP original.
- A imagem `outros/arte/animatronics/referencia-nao-identificada.png` manteve seu conteúdo, mas ainda precisa ser identificada visualmente antes de receber um nome de personagem.
- Evite arquivos soltos na raiz de `public/`. O verificador de assets rejeita mídias com espaços, acentos ou letras maiúsculas no nome final em `public/images/` e `public/audio/`.
