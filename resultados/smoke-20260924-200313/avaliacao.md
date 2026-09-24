### Teste de smoke

Teste executado em 24/09/2026 às 20:03. Olhei só o trecho em que a carga já estava no nível cheio: de 20s a 70s do teste, ou seja 50 segundos e 205 requisições. As subidas e descidas de carga ficam de fora da conta.

| O que foi medido | Resultado | O que eu precisava | Situação |
|---|---|---|---|
| Requisições por segundo | 4.1 | pelo menos 4 | passou |
| Tempo de resposta em que 90% das requisições ficaram abaixo | 1494 ms | menos de 2000 ms | passou |
| Requisições com erro | 0.00% | no máximo 1.0% | passou |
| Requisições por segundo, menor e maior valor | 1 e 7 | — | — |
| Compras finalizadas com sucesso | 52 (1.0 por segundo) | — | — |

Detalhe de cada requisição da compra:

| Requisição | Quantidade | Tempo médio | 90% abaixo de | 95% abaixo de | Pior caso | Tempo só para abrir a conexão | Erros |
|---|---|---|---|---|---|---|---|
| 01_Home | 50 | 1042 ms | 1501 ms | 2023 ms | 3433 ms | 273 ms | 0.00% |
| 02_Buscar_Voos | 51 | 818 ms | 1116 ms | 2590 ms | 3793 ms | 0 ms | 0.00% |
| 03_Escolher_Voo | 52 | 828 ms | 1460 ms | 3145 ms | 4035 ms | 0 ms | 0.00% |
| 04_Finalizar_Compra | 52 | 830 ms | 1444 ms | 1941 ms | 3171 ms | 0 ms | 0.00% |

**Resultado: o critério de aceitação foi atendido.**

A vazão ficou em 4.1 requisições por segundo, que é o que o critério pedia (pelo menos 4). O tempo de resposta de 90% das requisições ficou em 1494 ms, dentro do limite de 2 segundos. Nenhuma requisição falhou, então todas as compras foram concluídas com sucesso.

