# NNN — Créditos cinematográficos e 12ª morte (19/11/2026)

## Créditos finais: duração exata de 3:20

O modo `credits` mantém a música `public/audio/ending/creditos.mp3` e dura exatamente **200 segundos** (25 cartelas de 8 segundos), independentemente do fim da faixa. O botão **PULAR CRÉDITOS** e Escape continuam funcionando e devolvem o controle ao encerramento da noite ou ao menu Extras. Se o áudio falhar, a apresentação continua e mostra um aviso.

As 11 cenas novas fazem travellings digitais diferentes (aproximação, recuo, deslocamento horizontal e vertical). Cada cena ocupa 16 segundos, com duas cartelas de 8 segundos. A abertura ocupa 8 segundos, e o desfecho 16 segundos, sobre `creditos.png`. Cada troca de cena usa crossfade de 1,5 segundo com duas camadas de imagem; a próxima cena é pré-carregada. O movimento não depende de bibliotecas externas. A sequência considera `prefers-reduced-motion`.

| Tempo | Cena |
|---|---|
| 00:00–00:08 | Título / um jogo de Leon Soto |
| 00:08–00:24 | Restaurante vazio: criação / direção |
| 00:24–00:40 | Recepção: código / mecânicas |
| 00:40–00:56 | VIP com bonecas: IA / balanceamento |
| 00:56–01:12 | Gótica no lounge: arte / personagens |
| 01:12–01:28 | Cozinha: câmeras / interface |
| 01:28–01:44 | Maid na oficina: jumpscares / lore |
| 01:44–02:00 | Fliperama: som / produção |
| 02:00–02:16 | Yandere no corredor: FNAF / músicas Shikairo Days e Kawaikute Gomen |
| 02:16–02:32 | Palhaça no escritório: Caramelldansen, It's Not Like I Like You!!, Join Us for a Bite e The Amazing Digital Circus |
| 02:32–02:48 | Corredor das bonecas: ChatGPT (GPT), Codex, HTML/CSS/JS, GitHub |
| 02:48–03:04 | Lounge rosa e roxo: 12 guardas, Nathali Tomazine |
| 03:04–03:20 | Mensagem de encerramento e agradecimento |

### Créditos musicais e referências

- **Shikairo Days** (abertura de *My Deer Friend Nokotan*): Shika-bu (interpretação); Yūki Waga (composição); Kana Yaginuma (letra).
- **Kawaikute Gomen**: HoneyWorks; shito (composição e letra).
- **Caramelldansen**: Caramell; Jorge Vasconcelo e Juha Myllylä (composição).
- **It's Not Like I Like You!!**: Static-P e Amree.
- **Join Us for a Bite**: JT Music; voz de Andrea Storm Kaden na gravação original.
- **The Amazing Digital Circus**: Gooseworx (tema principal); Evan Alderete (trilha da série).
- **Sons e inspiração de terror**: *Five Nights at Freddy's* / Scott Cawthon. A homenagem não representa colaboração oficial.

Estes são créditos e reconhecimentos, **não autorização de uso** das composições ou dos efeitos. Verificar as licenças e os titulares dos áudios usados no jogo antes de uma distribuição pública.

Os nomes dos **12 guardas** são reconhecidos como inspirações para os personagens. **Nathali Tomazine** recebe crédito como inspiração para Nathzinha e agradecimento especial. Leon Soto permanece responsável pela autoria e desenvolvimento do jogo.

## Animação da 12ª morte

Mantido o arquivo `armarios.png` e a trilha `morte.mp3`. O panorama percorre a imagem cerca de **20% mais rápido**, com **10% a mais de ampliação**, sem deixar faixas vazias. A mensagem foi corrigida, dividida em duas linhas, centralizada e aparece com digitação de 62 ms por caractere:

> Agora só falta um para termos certeza de que ele foi morto.
> Os outros poderão aproveitar a festa para sempre.

A cena continua voltando ao Game Over após o áudio e a mensagem, mantendo o contador de vidas e o fluxo dos Extras.

## Arquivos

- `src/ending-sequences.js`: elenco, cronograma e reprodução.
- `src/styles/endings.css`: movimentos, fade, legibilidade e acessibilidade.
- `index.html`: camada extra para transição de imagens.
- `tests/endings.cjs`: validação dos créditos e da morte.
- `public/images/ending/*.png`: 11 imagens renomeadas para nomes portáveis, preservando os dados binários originais.

Teste: `node --test tests/endings.cjs`, mais os checks da workflow `validate.yml`.
