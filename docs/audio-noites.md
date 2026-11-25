# Áudio das noites

Os controladores narrativos ficam em `SoundEngine` (`src/sound.js`) e usam os mesmos pontos de início, atualização e encerramento do turno em `src/main.js`. Os parâmetros ficam em `config/controls.json`, em `nightAudio`. Execute `node scripts/sync-local-config.cjs` após editar o JSON para atualizar também o fallback de abertura local.

## Parâmetros iniciais

| Camada | Parâmetros |
| --- | --- |
| Ligações | Apenas noites 1–5, início 2 s após o turno; música automática respeita os 15 s originais e uma pausa adicional de 1 s após o término. Volume 0,22; armário 0,055. |
| Perfil telefônico | Mono, high-pass 310 Hz, low-pass 3.200 Hz (1.100 Hz no armário), compressor −24 dB / 3:1, saturação 0,12; ruído 0,009 com variação sutil. Conexão 140 ms; desligamento natural 180 ms. |
| Ambientes | Primeiro entre 8–18 s; intervalos de silêncio de 5–20 s após cada faixa. Entrada 3 s, saída até 4 s antes do final, crossfade de troca direta 3 s. Volumes A1/A2/A3: 0,16 / 0,13 / 0,14. |
| A3 | Disponível abaixo de 65%, com peso crescente até 4× em 0%. Recuperação para 65% encerra suavemente a faixa. |
| Caixa de sanidade | Volume máximo 0,24, proporcional a `clamp(1 - sanity, 0, 1)`; suavização curta de 150 ms e saída de recuperação de 500 ms. Loop do mesmo elemento, sem reinício em 0%. |
| Ducking | Ambientes a 38% durante ligação, 22% durante ameaça crítica, até 20% em sanidade zero. Ataque 250 ms / recuperação 1,2 s; eventos pontuais mantêm redução por 1,5 s. Hum de 55 Hz reduzido para 0,009 e sujeito ao mesmo ducking. |

O rádio usa o mesmo elemento de mídia nas músicas e nas ligações, com um único MediaElementSourceNode por elemento. A cadeia telefônica é removida ao trocar para música. Apenas o arquivo da ligação selecionada é carregado. Ambientes e caixa de sanidade usam elementos reutilizados durante a tentativa, com volumes atualizados por frame; não criam AudioContexts, elementos ou filtros por frame. O encerramento remove fontes, ruído e referências de mídia e invalida promessas pendentes.

As ligações não ativam `radioPlaying`; nenhum controlador novo fornece entrada para energia, sanidade, barulho ou IA. A caixa da Palhaça permanece no arquivo original e no controlador existente. Sem Web Audio (ou na abertura por `file:`), a reprodução usa volume HTMLMediaElement, sem filtros e panorama. O desbloqueio de áudio continua dependente da interação inicial do jogador; rejeições de autoplay são tratadas sem promessas não capturadas.

## Verificação

- `node --test tests/night-audio.cjs tests/sound.cjs tests/office-controls-power.cjs`: mapeamento de noites, atraso, silêncio manual, término natural, prioridade sobre autoplay musical, apagão, A3, fades e intervalos, sanidade fracionária, recuperação, independência da Palhaça e descarte de reprodução pendente.
- `node scripts/check-assets.cjs` e `node scripts/sync-local-config.cjs --check`: referências, seleção de publicação e fallback local.
- Chrome headless com arquivos reais: reprodução de N1–N5, metadados de A1–A3, filtros mono/armário, reutilização da fonte, isolamento do perfil musical, reprodução da caixa em 1%/0,5%/0%, recuperação e encerramento com contexto suspenso. O jogo também inicializou sem exceções JavaScript nesse teste.
- A suíte geral já contém falhas de expectativas de balanceamento, finais e mocks. A comparação com os arquivos do commit original não identificou novos nomes de testes falhando.

A conferência auditiva subjetiva com fones e uma passagem manual completa por morte, vitória e menus não foram realizadas. O loop usa a implementação nativa de WAV do navegador; a percepção da emenda depende da gravação e do navegador. Os testes automatizados cobrem o encerramento compartilhado usado por essas transições.
