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

## Efeitos e falas por evento

Os 18 arquivos da segunda integração foram movidos sem conversão para `effects/interface`, `effects/invasion`, `characters/maid`, `characters/palhaca`, `characters/padrao` e `voices`. `Medo1.mp3`, `Medo2.mp3` e `Medo3.mp3` permanecem intactos e agora integram o controlador psicológico descrito abaixo.

As configurações ficam em `config/effects.json`:

- `eventSounds`: erro 0,30; queda de energia 0,40; troca de câmera 0,24; contra-ataque pelo estoque, susto da lanterna, Maid e fase final da Palhaça 0,32. As variantes são escolhidas uma vez por evento. O contra-ataque central aguarda o término real das batidas e omite a risada de estoque daquele ataque. Listeners pendentes são removidos no encerramento.
- `specialVoices`: exclusivamente campanha 5–9; S1–S4 a 0,28 em defesas efetivas, R1–R2 a 0,30 aos 85% da barra da Padrão, C1 a 0,27 após 25 s sem observação real de câmeras (60%), Now We Can a 0,30 por invasão da Padrão (80%) e Birthday a 0,27 por mudança efetiva de posição da Padrão (1%). Cada arquivo tem limite individual por tentativa; as seleções não usam o gerador injetado na IA. A fala especial de invasão desativa as falas tradicionais de entrada no armário somente naquela invasão.
- A espera irreversível da Palhaça fica em `config/threats.json`, `clown.finaleSeconds` (8–12 s). O prazo é sorteado uma vez ao atingir 100%; a lanterna do armário é desligada e bloqueada, a pose na porta some e o jumpscare existente acontece no prazo. Outras causas letais da Palhaça são preservadas.
- A penalidade de lanterna atrasada fica em `config/sanity.json`, `eventLoss.lateFlashlight` (1 ponto percentual). É aplicada pela simulação, uma vez por ataque de corredor, quando a luz é usada apenas após a posição avançada (55%, configurado em `movement.attack.bar.advancedProgress`). A luz usada na fase inicial impede essa penalidade.

O rádio silencia a ligação já no `pointerdown` e consome o clique seguinte do mesmo gesto. Teclado e cliques de acessibilidade continuam usando `toggleRadio()`. A identificação inclui o arquivo efetivamente em reprodução para tolerar uma flag de ligação desatualizada. O próximo gesto controla a música normalmente, mantendo o perfil espacial e telefônico existente.

Verificação adicional: `node --test tests/event-audio.cjs tests/night-audio.cjs tests/sound.cjs tests/office-controls-power.cjs` passou nos 27 testes. Chrome headless validou os 18 arquivos, dois cliques reais de mouse no rádio, tentativa de portão na Noite 1, tecla W sem repetição de erro, troca efetiva de câmera e flags visuais da fase final da Palhaça. A suíte completa passou em 69 testes e manteve os mesmos 25 nomes de falhas anteriores. A seleção de publicação inclui todos os novos arquivos; `check-assets.cjs` ainda acusa exclusivamente a nomenclatura de Medo1–3, mantidos conforme solicitado. Não houve conferência auditiva subjetiva com fones.


## Medo dinâmico (26/11/2026)

`config/effects.json`, bloco `fear`, configura os três estados. A simulação informa invasão convencional, barra real estritamente acima do estágio configurado e eventos pontuais de recuperação. A posição avançada continua irreversível, mas não mantém Medo2 quando a barra regride a 55% ou menos. O aviso da Padrão continua em 85%.

| Arquivo | Duração PCM decodificada | RMS médio / pico (dBFS) | Volume | Entrada / saída |
| --- | ---: | ---: | ---: | ---: |
| Medo1.mp3 | 4,307313 s | −29,9 / −19,2 | 0,45 | 0,70 / 0,80 s |
| Medo2.mp3 | 13,739479 s | −33,7 / −20,5 | 0,70 | 0,35 / 0,60 s |
| Medo3.mp3 | 9,815771 s | −34,0 / −20,0 | 0,82 | 0,08 / 0,80 s |

Análise individual com FFmpeg 7+/`volumedetect`, `silencedetect` (−50 dBFS, mínimo 50 ms) e PCM estéreo float: todos são 48 kHz, sem silêncios detectáveis no começo/final. RMS dos primeiros/últimos 500 ms: Medo1 0,02841/0,03061; Medo2 0,01899/0,01862; Medo3 0,01793/0,01574. As diferenças entre amostras das extremidades são pequenas, mas não nulas (aproximadamente 0,00355, 0,00319 e 0,00298). As faixas têm energia até as bordas: repetição seca não foi escolhida. As durações do contêiner arredondadas pelo FFmpeg são 4,31/13,74/9,82 s; a tabela usa a quantidade real de amostras decodificadas.

Cada faixa reutiliza duas vozes HTMLMediaElement, pré-carregadas, alternadas com crossfade linear de 400 ms antes do final real. O blend acompanha `currentTime` da voz entrante, não um timer independente; não há mudança de velocidade nem dependência de `ended` para iniciar a próxima voz. Os pesos do loop somam 1, evitando aumento artificial de volume nas emendas. Os volumes compensam os aproximadamente 4 dB a mais de Medo1: RMS resultante aproximado de −36,8/−36,8/−35,7 dBFS. Não há normalização destrutiva dos arquivos. Frames prolongados ou suspensão da página podem atrasar um crossfade; a verificação objetiva não substitui uma conferência subjetiva com fones.

Apenas um estado predomina; camadas anteriores se sobrepõem brevemente durante a saída. A invasão entra em 80 ms e acelera a saída das camadas inferiores para esse mesmo tempo. A última invasora dispara recuperação de 7 s; um novo perigo descarta a recuperação, sem fila. Medo2 reage ao limiar exato; oscilações breves revertem o fade da mesma reprodução sem reiniciar o arquivo. Medo1 nunca nasce de uma defesa antes da invasão.

Os ambientes, incluindo o hum, têm alvo de 25% durante o medo, combinado por mínimo com os duckings existentes. Batidas, vozes, avisos, risadas e caixa de sanidade mantêm seus controles e volumes. As faixas não passam pelo rádio, não alteram recursos ou ruído da IA e não dependem da perspectiva. Smores continua com áudio próprio; Shadow, Palhaça e alucinações não contam como invasoras convencionais. O flash de invasão mantém `effects.invasion.flashMs`.

O descarte usa `stopNightAudio`, os mesmos elementos registrados em `nightMedia` e a proteção `mediaEpoch`/`isNightClipActive`. Morte, vitória, créditos, menu e reinício param vozes, limpam estados/recuperação e invalidam promessas de reprodução. Não há timers novos no controlador.

A sabotagem reserva a falha elétrica e cobra energia imediatamente. Só cobra sanidade e inicia o susto se há câmera efetivamente aberta, sem armário, bloqueio de observação ou estática. A causa `sabotage` reutiliza imagem/som/duração sem aplicar a penalidade `yandereCameraScare`, desligar o computador ou gastar usos de surpresa. Sair da câmera não cancela a falha reservada. Ao término, a falha se torna visível e o evento de recuperação é emitido. Um susto já em andamento é reaproveitado; não há segunda animação. A causa `observation` preserva suas consequências originais. Apagão e restauração continuam sob os controladores existentes.


Verificação desta integração:

- 21/21 testes de `tests/attack-system.cjs` aprovados: 108 cenários de ruído fixo, 288 de reação, 72.000 ensaios isolados, 4.000 controles passivos, posições, regressão, capacidades, invasões simultâneas e proteção do armário. O fixture isolado agora declara abertura sem espera, sem alterar a espera real da campanha. Relatório regenerado em `docs/generated/attack-balance.json`.
- 27/27 testes de efeitos, áudio noturno, áudio e controles aprovados. O antigo teste do loop genérico foi atualizado para prioridade, crossfade, oscilações de limiar, retomada sem reinício, descarte de recuperação e resolução atrasada de `play()` após encerramento.
- Verificação específica de sabotagem aprovada: escritório, armário, desktop, câmera bloqueada, qualquer câmera ativa, saída durante o susto, frame prolongado, apagão provocado pela perda de energia, interrupção da partida e restauração manual. O susto por observação mantém os 15 pontos e desligamento; ambos emitem recuperação ao terminar.
- Chrome headless, página real e MP3 originais: durações 4,307313/13,739479/9,815771 s; duas reproduções por faixa durante as emendas, recuperação temporária e encerramento de todas as vozes. Zero erros de mídia ou JavaScript. Não foi realizada escuta subjetiva com fones nem uma noite manual completa.
- O grupo de testes com `balance.cjs` mantém os mesmos 13 nomes de falhas do HEAD anterior (confirmados executando os módulos/configurações originais), sem falha adicional. Os novos cenários específicos passam. As expectativas históricas alheias ao escopo não foram rebalanceadas para tornar a suíte verde.
- Fallback local sincronizado e pacote estático validado: 302 caminhos, 321 arquivos. O validador reconhece os nomes originais configurados de Medo1–3, sem renomear os áudios.
