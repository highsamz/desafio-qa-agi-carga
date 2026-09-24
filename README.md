# BlazeDemo — Teste de Performance (JMeter)

Teste de carga e teste de pico do fluxo de **compra de passagem aérea** em [blazedemo.com](https://www.blazedemo.com), com avaliação automática do critério de aceitação.

| Item | Definição |
|---|---|
| Cenário | Compra de passagem aérea — passagem comprada com sucesso |
| Critério de aceitação | **250 req/s** com **p90 < 2 s** |
| Ferramenta | Apache JMeter 5.6.3 (sem plugins) |
| Modelo de carga | Open Model Thread Group (taxa de chegada controlada) |

## Estrutura

```
tests/teste-carga.jmx        Teste de carga (platô sustentado)
tests/teste-pico.jmx         Teste de pico (salto repentino + recuperação)
data/rotas.csv               Massa: 42 combinações origem/destino
config/relatorio.properties  Formato do JTL e configuração do dashboard (p90, Apdex 2 s)
scripts/run.sh               Executa, gera o dashboard e avalia o critério
scripts/avaliar_criterio.py  Calcula vazão e p90 na janela de estabilidade (PASS/FAIL)
.github/workflows/           Execução sob demanda no GitHub Actions
resultados/                  Relatórios das execuções
```

## Fluxo do script

Cada iteração representa **uma compra completa (4 requisições HTTP)**:

| # | Requisição | Validação | Correlação |
|---|---|---|---|
| 01 | `GET /` | "Welcome to the Simple Travel Agency!" | — |
| 02 | `POST /reserve.php` (origem/destino do CSV) | "Choose This Flight" | Extrai todos os voos e sorteia um (flight, price e airline da mesma linha) |
| 03 | `POST /purchase.php` | "has been reserved" | Extrai `_token` |
| 04 | `POST /confirmation.php` (dados do passageiro e cartão de teste) | **"Thank you for your purchase today!"** | — |

A requisição 04 com sucesso é a evidência de "passagem comprada com sucesso". Recursos embutidos (CSS/JS/imagens) não são baixados: o critério é medido sobre as requisições da transação de negócio.

## Modelagem da carga

**Premissa:** "250 requisições por segundo" = 250 requisições HTTP/s. Como cada compra tem 4 requisições, isso equivale a **62,5 compras/s**. O alvo de injeção é **63 compras/s (252 req/s)**, ~1% acima da meta, para absorver a variação natural de medição sem ficar abaixo de 250.

Foi usado o **Open Model Thread Group** (nativo desde o JMeter 5.5): a carga é definida por taxa de chegada, e não por número fixo de usuários. Assim a vazão injetada não cai quando o servidor fica lento — num modelo fechado, a lentidão reduz a vazão e mascara o problema (*coordinated omission*). Se o servidor degradar, isso aparece como aumento de tempo de resposta e de threads ativas, que é exatamente o que se quer observar.

| Teste | Perfil | Duração | Janela avaliada |
|---|---|---|---|
| Carga | Rampa 0→252 req/s em 2 min, **platô de 10 min**, descida em 1 min | ~13,5 min | 130 s a 710 s |
| Pico | Base de 25 req/s por 2 min, **salto para 252 req/s em 10 s**, pico por 3 min, volta à base em 10 s e 3 min de recuperação | ~9,5 min | 165 s a 335 s |

```
Carga   req/s                          Pico    req/s
 252 |      ________________            252 |          ______
     |     /                \               |         |      |
     |    /                  \              |    _____|      |______
   0 |___/                    \___       25 |___/                   \___
       2m        10 min       1m              2m   10s  3m  10s  3m
```

## Como executar

**Pré-requisitos:** Java 17+, [JMeter 5.6.3](https://jmeter.apache.org/download_jmeter.cgi) no `PATH` (ou `JMETER_HOME` definido) e Python 3 (para a avaliação).

```bash
git clone <URL_DO_REPOSITORIO> && cd <repositorio>

./scripts/run.sh smoke   # 1 compra/s por 1 min — valida o script antes da carga
./scripts/run.sh carga   # teste de carga
./scripts/run.sh pico    # teste de pico
```

Cada execução cria `resultados/<teste>-<data>/` com:

- `dashboard/index.html` — relatório HTML do JMeter
- `avaliacao.md` — tabela de métricas na janela de estabilidade e veredito do critério
- `resultados.jtl` e `jmeter.log` (não versionados)

**Parâmetros** (variáveis de ambiente): `RATE` (compras/min, padrão 3780), `RAMPUP` e `DURACAO` (min, só carga). Ex.: `DURACAO=20 ./scripts/run.sh carga`.

**Windows (sem o run.sh):**

```bat
jmeter -n -t tests\teste-carga.jmx -q config\relatorio.properties -l resultados\carga\resultados.jtl -e -o resultados\carga\dashboard
python scripts\avaliar_criterio.py resultados\carga\resultados.jtl --inicio 130 --fim 710
```

Para o pico, troque o `.jmx` e use `--inicio 165 --fim 335`.

**Modo GUI:** abra o `.jmx` no JMeter apenas para inspeção/depuração (adicione um *View Results Tree* e rode com `-Jrate=60`). Testes de carga devem rodar sempre em modo CLI.

**GitHub Actions:** aba *Actions* → *performance* → *Run workflow* (smoke, carga ou pico). O relatório fica disponível como artefato e a avaliação no resumo do job.

## Relatório de execução

> Ambiente de execução: _máquina (CPU/RAM), sistema operacional, rede, localização, data/hora_

### Teste de carga

_Colar aqui o conteúdo de `resultados/carga-<data>/avaliacao.md`_

Dashboard: [`resultados/carga-<data>/dashboard/index.html`](resultados/)

_Prints sugeridos: Statistics, Transactions per Second, Response Time Percentiles Over Time, Active Threads Over Time_

### Teste de pico

_Colar aqui o conteúdo de `resultados/pico-<data>/avaliacao.md`_

Dashboard: [`resultados/pico-<data>/dashboard/index.html`](resultados/)

### Conclusão

_O critério de aceitação foi / não foi satisfeito, porque..._

**Como a conclusão é tomada.** O critério é considerado satisfeito somente se, na janela de estabilidade:

1. a vazão média for **≥ 250 req/s**;
2. o **percentil 90** do tempo de resposta (todas as requisições) for **< 2000 ms**;
3. a taxa de erro for **≤ 1%** (premissa: vazão com falhas não conta como "passagem comprada com sucesso").

Na análise também são considerados: se a vazão ficou estável ao longo do platô (gráfico *Transactions per Second*), se o p90 cresceu ao longo do tempo (sinal de saturação), o crescimento de threads ativas (no modelo aberto, indica que o servidor não está acompanhando a taxa de chegada), os códigos de erro (ex.: `429`/`503` indicam limitação ou sobrecarga do servidor) e, no pico, se o tempo de resposta volta ao patamar da base durante a recuperação.

> A coluna *Throughput* da tabela Statistics do dashboard é a média do teste inteiro, incluindo rampas, por isso fica abaixo de 250. A vazão do critério é medida no platô pelo `avaliar_criterio.py`.

## Considerações

- **Ambiente-alvo público e compartilhado.** O BlazeDemo é uma aplicação de demonstração sem SLA, sem controle sobre infraestrutura, CDN/WAF ou limitação de taxa, e com outros usuários testando ao mesmo tempo. Os resultados variam entre execuções e não refletem capacidade de um ambiente dimensionado. Os testes não passam do alvo do critério para não sobrecarregar o serviço.
- **Gerador de carga.** Se a máquina que executa o JMeter saturar (CPU > 80%, memória, banda ou portas), o resultado mede o gerador e não a aplicação. Acompanhe os recursos durante a execução; se necessário, use uma máquina mais robusta ou execução distribuída.
- **Latência de rede.** O tempo de resposta inclui a distância entre o gerador e o servidor (ex.: Brasil → EUA acrescenta ~150 ms por requisição).
- **Massa de dados.** Rotas em CSV (compartilhado entre threads) e voo sorteado a cada iteração, evitando que todas as compras sigam o mesmo caminho. Dados de passageiro gerados com `__RandomString`/`__Random` e cartão de teste `4111 1111 1111 1111`.
- **Interpretação alternativa.** Se a meta for 250 **compras**/s (1000 req/s), basta executar com `RATE=15000`.
- **Open Model Thread Group** é marcado como experimental no JMeter; foi escolhido por ser nativo (sem plugins) e modelar vazão com precisão. A alternativa com plugins seria *Concurrency Thread Group* + *Throughput Shaping Timer*.
