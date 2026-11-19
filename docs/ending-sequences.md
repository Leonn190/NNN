# NNN — Finais cinematográficos, mídia e rádio

## Mídias reais integradas (19/11/2026)

Os cinco arquivos carregados pelo autor foram **movidos sem alterar os bytes** para os caminhos usados pelo jogo. Os nomes originais tinham letras maiúsculas, espaços ou estavam soltos em public/, o que contrariava as regras de validação do projeto.

| Arquivo original em `main` | Caminho padronizado neste PR | Uso |
|---|---|---|
| `public/images/Bonecas Animatrônicas no Palco Neon.png` | `public/images/ending/creditos.png` | Fundo flutuante dos créditos |
| `public/images/Corredor Neon dos Doze Armários.png` | `public/images/ending/armarios.png` | Panorâmica da 12ª morte |
| `public/audio/Creditos.mp3` | `public/audio/ending/creditos.mp3` | Trilha dos créditos e rádio desbloqueável |
| `public/audio/morte.mp3` | `public/audio/ending/morte.mp3` | Trilha da morte especial |
| `public/audio/nightcore-it-s-not-like-i-like-you-lyrics-128-ytshorts.savetube.me.mp3` | `public/audio/radio/musica-nova.mp3` | Nova faixa normal do rádio |

O `scripts/pages-files.cjs` foi atualizado para incluir imagens PNG em `public/images/ending` no pacote do GitHub Pages. O verificador de assets volta a tratar **todos os caminhos necessários como obrigatórios**, sem exceções para mídia pendente.

## Comportamento

- **Vitória real na 9ª noite:** o progresso e a estrela são gravados; entra a cena dos créditos, com câmera flutuando sobre a imagem original. A cada 7,2 s, passam **dois** créditos simultâneos, sempre `Leon Soto` como responsável. As duplas podem repetir enquanto a música estiver tocando. Ao terminar ou pular (Escape/botão), volta à tela normal de vitória.
- **12ª morte:** ocorre o jumpscare tradicional, depois a cena especial com os armários. A câmera passa da esquerda para a direita, e no final aparece o texto original letra por letra em branco: `Agora só falta 1 para termos certeza que ele foi morto, o outros poderão aproveitar a festa para sempre`. Depois retorna ao Game Over normal. A campanha continua jogável com o contador `00/12`, sem exclusão automática.
- **Extras:** o menu contém duas prévias de um clique, que não consomem vidas nem alteram conquistas ou notas.
- **Rádio:** a faixa `musica-nova.mp3` pode tocar nas noites comuns. Após completar as nove noites, o jogo grava a estrela de vitória e permite também a faixa dos créditos no rádio, inclusive depois de fechar e abrir o navegador. Essa condição é persistente pelo armazenamento local.
- **Balanceamento:** nível mínimo com redução de intervalo de movimento 0%; redução máxima de 52% nas demais animatrônicas e 58% na Padrão.

## Testes

```sh
node scripts/sync-local-config.cjs --check
node scripts/package-pages.cjs
node scripts/check-assets.cjs dist
node --test tests/balance.cjs tests/image-cache.cjs tests/sound.cjs tests/notes.cjs tests/campaigns.cjs tests/endings.cjs
```
