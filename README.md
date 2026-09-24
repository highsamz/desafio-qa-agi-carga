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

> Rode o smoke primeiro e confira a coluna *Tempo só para abrir a conexão* do `avaliacao.md`. Se ela vier na casa dos 10 segundos, o IPv4 do alvo não está acessível na sua rede — rode com `JVM_ARGS="-Djava.net.preferIPv6Addresses=true"`. Detalhes em *Considerações*.

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

Para o pico, troque o `.jmx` e use `--inicio 165 --fim 335`. Redirecione a saída para o arquivo do relatório com `> resultados\cargavaliacao.md`.

O `avaliar_criterio.py` termina com código `0` quando o critério é atendido, `3` quando não é e `1` em caso de erro de execução — o `run.sh` usa isso para não confundir "critério reprovado" com "a avaliação quebrou".

**Modo GUI:** abra o `.jmx` no JMeter apenas para inspeção/depuração (adicione um *View Results Tree* e rode com `-Jrate=60`). Testes de carga devem rodar sempre em modo CLI.

**GitHub Actions:** aba *Actions* → *performance* → *Run workflow* (smoke, carga ou pico). O relatório fica disponível como artefato e a avaliação no resumo do job.

## Relatório de execução

Os relatórios completos estão em `resultados/<teste>-<data>/avaliacao.md` e o dashboard HTML do JMeter em `resultados/<teste>-<data>/dashboard/index.html`.

**Ambiente de execução:** Intel Core i5-1135G7 (4 núcleos / 8 threads), 20 GB de RAM, Windows 11, Java 21, JMeter 5.6.3. Gerador de carga no Brasil, em rede doméstica, contra o BlazeDemo hospedado nos EUA. Execuções de 24/09/2026.

### Teste de pico

Execução das 15:27 — [`resultados/pico-20260924-152752/avaliacao.md`](resultados/pico-20260924-152752/avaliacao.md) · [dashboard](resultados/pico-20260924-152752/dashboard/index.html)

Janela analisada: 165 s a 335 s (170 s de platô do pico), 42.845 requisições.

| O que foi medido | Resultado | Meta | Situação |
|---|---|---|---|
| Requisições por segundo | 252,0 | ≥ 250 | passou |
| p90 do tempo de resposta | 490 ms | < 2.000 ms | passou |
| Taxa de erro | 0,00% | ≤ 1% | passou |
| Compras concluídas com sucesso | 10.716 (63,0/s) | — | — |

O salto de 25 para 252 req/s em 10 segundos foi absorvido sem degradação, sem nenhum erro, e o tempo de resposta voltou ao patamar da base logo após o pico.

### Teste de carga

Execução das 20:06 — [`resultados/carga-20260924-200631/avaliacao.md`](resultados/carga-20260924-200631/avaliacao.md) · [dashboard](resultados/carga-20260924-200631/dashboard/index.html)

Janela analisada: 130 s a 710 s (580 s de platô), 146.256 requisições.

| O que foi medido | Resultado | Meta | Situação |
|---|---|---|---|
| Requisições por segundo | 252,2 | ≥ 250 | passou |
| p90 do tempo de resposta | 5.513 ms | < 2.000 ms | não passou |
| Taxa de erro | 1,33% | ≤ 1% | não passou |
| Compras concluídas com sucesso | 36.104 (62,2/s) | — | — |

Comportamento ao longo do platô:

| Minuto | Requisições | p90 | Respostas `429` | Tempo de conexão |
|---|---|---|---|---|
| 0 | 3.578 | 2.189 ms | 0 | 266 ms |
| 2 | 15.112 | 4.964 ms | 60 | 262 ms |
| 4 | 15.225 | 5.980 ms | 186 | 256 ms |
| 6 | 15.064 | 6.029 ms | 137 | 257 ms |
| 8 | 15.139 | 3.802 ms | 345 | 257 ms |
| 10 | 15.064 | 4.487 ms | 210 | 261 ms |
| 12 | 8.144 | 2.525 ms | 116 | 272 ms |

### Conclusão

**O critério de aceitação foi atendido no teste de pico e não foi atendido no teste de carga sustentada. O limite é do BlazeDemo: ele não sustenta 250 req/s por 10 minutos.**

O gerador entregou a vazão pedida nos dois testes — 252,0 req/s no pico e 252,2 req/s na carga —, então a injeção de carga funcionou como planejado em ambos. A diferença está na resposta da aplicação.

No teste de pico, 252 req/s por 3 minutos passaram com p90 de 490 ms e nenhum erro. Folga confortável em relação aos 2 segundos exigidos.

No teste de carga, a mesma taxa mantida por 10 minutos saturou a aplicação. Três evidências apontam para o servidor, e não para o ambiente de teste:

- **As quatro requisições degradaram juntas.** As médias ficaram em 2.016 ms, 1.732 ms, 1.744 ms e 1.755 ms — todas na mesma ordem de grandeza. Quando o gargalo é do gerador ou da rede, só a requisição que abre conexão piora; aqui piorou o fluxo inteiro.
- **O servidor passou a recusar requisições com `429 Too Many Requests`.** Os erros começam no primeiro minuto do platô e crescem até 345 por minuto. `429` é a aplicação dizendo explicitamente que está recebendo mais requisições do que aceita — foram 1.940 respostas `429` e 1 resposta `500`, totalizando 1,33% de erro. Como o cenário exige "passagem comprada com sucesso", requisição recusada não conta como vazão útil.
- **A degradação é progressiva, no formato de saturação.** O p90 sai de 2.189 ms no primeiro minuto e chega a 6.501 ms no quinto, oscilando entre 3,8 s e 6,5 s pelo resto do platô — mais de dez vezes o p90 medido no pico. Já o tempo de conexão ficou estável entre 256 ms e 272 ms do começo ao fim, o que descarta problema de rede ou do gerador.

**Por que o pico passa e a carga não.** É o comportamento típico de limitação de taxa por cota: uma rajada curta cabe no saldo acumulado, mas a taxa sustentada esgota esse saldo e o servidor começa a recusar. Os 3 minutos de pico não chegaram a disparar a limitação; os 10 minutos de platô dispararam já no primeiro minuto.

**Resposta ao critério:** não é possível afirmar que o BlazeDemo atende a 250 requisições por segundo com p90 abaixo de 2 segundos. Ele atende a essa vazão em rajadas de poucos minutos, mas em carga contínua o p90 chega a 5,5 s e 1,33% das requisições são recusadas. Vale lembrar que o BlazeDemo é uma aplicação pública de demonstração, sem SLA e compartilhada com outros usuários — o resultado mede o que essa instância entrega, e não a capacidade de um ambiente dimensionado para o cenário.

**Como a conclusão é tomada.** O critério é considerado satisfeito somente se, na janela de estabilidade:

1. a vazão média for **≥ 250 req/s**;
2. o **percentil 90** do tempo de resposta (todas as requisições) for **< 2000 ms**;
3. a taxa de erro for **≤ 1%** (premissa: vazão com falhas não conta como "passagem comprada com sucesso").

Na análise também são considerados: se a vazão ficou estável ao longo do platô (gráfico *Transactions per Second*), se o p90 cresceu ao longo do tempo (sinal de saturação), o crescimento de threads ativas (no modelo aberto, indica que o servidor não está acompanhando a taxa de chegada), o tempo de conexão por requisição (separa problema de rede ou do gerador de lentidão da aplicação), os códigos de erro (`429` indica limitação de taxa e `503` sobrecarga) e, no pico, se o tempo de resposta volta ao patamar da base durante a recuperação.

> A coluna *Throughput* da tabela Statistics do dashboard é a média do teste inteiro, incluindo rampas, por isso fica abaixo de 250. A vazão do critério é medida no platô pelo `avaliar_criterio.py`.

## Considerações

- **Ambiente-alvo público e compartilhado.** O BlazeDemo é uma aplicação de demonstração sem SLA, sem controle sobre infraestrutura, CDN/WAF ou limitação de taxa, e com outros usuários testando ao mesmo tempo. Os resultados variam bastante entre execuções: às 15:27 a aplicação respondeu a 252 req/s com p90 de 490 ms, e às 20:06 a mesma taxa produziu p90 de 5,5 s e respostas `429`. Os testes não passam do alvo do critério para não sobrecarregar o serviço.
- **IPv4 x IPv6 (armadilha encontrada nestes testes).** Na primeira rodada, o `Connect` da `01_Home` ficou em ~10.159 ms enquanto as outras três requisições respondiam em ~320 ms. A causa: `www.blazedemo.com` resolve para um IPv4 (`172.217.30.115`) que não aceita conexão na porta 443 a partir desta rede, e o JMeter usa IPv4 por padrão. Cada conexão nova esgotava o `connect_timeout` de 10 s do plano antes de conectar na retentativa — daí o valor travado em ~10 s. Só a `01_Home` era afetada porque é a única que abre conexão; as demais reaproveitam via keep-alive. A solução é fazer a JVM preferir IPv6:

  ```bash
  JVM_ARGS="-Djava.net.preferIPv6Addresses=true" ./scripts/run.sh carga
  ```

  Com isso o `Connect` caiu para ~257 ms e permaneceu estável durante os 13 minutos de teste. Vale conferir o `Connect` num smoke antes de rodar a carga: se ele estiver alto já com 1 compra por segundo, o problema é de rede e não de capacidade.
- **Como separar problema de ambiente de problema da aplicação.** A coluna *Tempo só para abrir a conexão* do `avaliacao.md` traz a mediana do campo *Connect* por requisição. Tempo alto só na requisição que abre conexão indica rede ou gerador; tempo alto nas quatro requisições, crescendo ao longo do teste e acompanhado de `429`/`503`, indica saturação da aplicação. Foi exatamente essa diferença que separou as duas rodadas do teste de carga.
- **Gerador de carga.** Se a máquina que executa o JMeter saturar (CPU > 80%, memória, banda ou portas), o resultado mede o gerador e não a aplicação. Acompanhe os recursos durante a execução; se necessário, use uma máquina mais robusta ou execução distribuída. A 63 compras/s o gerador abre ~63 conexões novas por segundo — em platôs bem mais longos que 10 minutos pode ser preciso ampliar o intervalo de portas dinâmicas (`netsh int ipv4 set dynamicport tcp start=10000 num=55000`) e reduzir o `TcpTimedWaitDelay` do Windows.
- **Latência de rede.** O tempo de resposta inclui a distância entre o gerador e o servidor (ex.: Brasil → EUA acrescenta ~150 ms por requisição).
- **Massa de dados.** Rotas em CSV (compartilhado entre threads) e voo sorteado a cada iteração, evitando que todas as compras sigam o mesmo caminho. Dados de passageiro gerados com `__RandomString`/`__Random` e cartão de teste `4111 1111 1111 1111`.
- **Interpretação alternativa.** Se a meta for 250 **compras**/s (1000 req/s), basta executar com `RATE=15000`.
- **Open Model Thread Group** é marcado como experimental no JMeter; foi escolhido por ser nativo (sem plugins) e modelar vazão com precisão. A alternativa com plugins seria *Concurrency Thread Group* + *Throughput Shaping Timer*.
