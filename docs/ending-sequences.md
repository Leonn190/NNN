# Créditos finais e 12ª morte — mídia e comportamento

Implementado em `feat/creditos-12-mortes-radio-20261119`.

## Arquivos de mídia necessários

As novas artes e faixas mencionadas na solicitação **não estavam em nenhuma branch do GitHub consultada em 19/11/2026**. O código deste PR usa estes caminhos exatos (minúsculos e sem espaços):

| Caminho | Finalidade |
|---|---|
| `public/images/ending/creditos.webp` | Imagem ampla do final das nove noites. A câmera flutua lentamente sobre ela |
| `public/audio/ending/creditos.mp3` | Música do final após a vitória; também é liberada no rádio após vencer as nove noites |
| `public/images/ending/armarios.webp` | Imagem panorâmica dos **12 armários**, sem mãos nas portas; a câmera vai da esquerda à direita |
| `public/audio/ending/morte.mp3` | Música especial da 12ª morte |
| `public/audio/radio/musica-nova.mp3` | Nova música de rádio, sem referência a créditos ou morte no nome |

**Para ativar a arte e o áudio originais, envie esses cinco arquivos no repositório com exatamente esses caminhos.** A ausência das quatro mídias das sequências aparece no próprio modo Extras e como aviso (não erro) no verificador de assets, permitindo que o código seja revisado antes do upload. A faixa nova do rádio faz fallback para uma faixa existente se ainda não estiver presente.

O GitHub Pages empacota automaticamente novos arquivos `.webp` dessas pastas e todos os novos `.mp3` de `public/audio`. Para imagens em PNG, converta para WebP ou ajuste os dois caminhos em `src/ending-sequences.js`.

## Fluxos

**Vitória da 9ª noite**: ao vencer uma campanha válida, o jogo grava a estrela habitual, abre a imagem com câmera flutuante, reproduz a música de créditos e mostra dois cartões de créditos por vez, atribuindo os papéis a **Leon Soto**. Ao terminar, a tela habitual de turno concluído aparece. O jogador pode pular pelo botão ou tecla Escape. A música de créditos entra na seleção aleatória do rádio das **noites seguintes**, inclusive em campanhas novas, pois o desbloqueio fica gravado no armazenamento das estrelas.

**12ª morte**: o jogo mantém `00/12` e a campanha existente. Após o jumpscare, abre o panorama dos armários e reproduz a música de morte. A câmera atravessa a imagem da esquerda para a direita; ao terminar, a mensagem informada pelo autor surge caractere a caractere em branco. Em seguida volta à tela de Game Over, com opção normal de tentar novamente. A sequência acontece apenas no momento de atingir a 12ª morte; mortes posteriores não ficam repetindo o especial.

**Extras**: os botões `Créditos · Final das 9 noites` e `12ª morte · Armários` reproduzem as duas cenas sem alterar vidas, noites, estrelas nem anotações.

## Temporização

- Créditos: dois cartões por tela, com troca a cada 7,2 s. A música segue até seu final; se acabar antes do último par, os créditos ainda concluem. Se o arquivo de áudio estiver ausente, a apresentação fecha após percorrer os pares.
- 12ª morte: pan de 28 s por padrão; quando a duração da música já estiver carregada, ajusta o pan para reservar aproximadamente 13 s finais para a mensagem (entre 14 e 75 s de panorâmica). Digitação: 74 ms por caractere. A música termina normalmente; há avanço manual a qualquer momento.
- Preferência do sistema por movimento reduzido: animações de câmera são desativadas, mantendo créditos e texto legíveis.

## Balanceamento

A redução do intervalo por nível máximo passa a **52%** para todas as animatrônicas, exceto a **Padrão**, cujo máximo passa a **58%**. O cálculo continua interpolando a partir de 0% no nível mínimo.

## Testes

`node scripts/sync-local-config.cjs --check`

`node scripts/package-pages.cjs && node scripts/check-assets.cjs dist`

`node --test tests/balance.cjs tests/image-cache.cjs tests/sound.cjs tests/notes.cjs tests/campaigns.cjs tests/endings.cjs`
