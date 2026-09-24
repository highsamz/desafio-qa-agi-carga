### Teste de pico

Teste executado em 24/09/2026 às 15:27. Olhei só o trecho em que a carga já estava no nível cheio: de 165s a 335s do teste, ou seja 170 segundos e 42845 requisições. As subidas e descidas de carga ficam de fora da conta.

| O que foi medido | Resultado | O que eu precisava | Situação |
|---|---|---|---|
| Requisições por segundo | 252.0 | pelo menos 250 | passou |
| Tempo de resposta em que 90% das requisições ficaram abaixo | 490 ms | menos de 2000 ms | passou |
| Requisições com erro | 0.00% | no máximo 1.0% | passou |
| Requisições por segundo, menor e maior valor | 204 e 288 | — | — |
| Compras finalizadas com sucesso | 10716 (63.0 por segundo) | — | — |

Detalhe de cada requisição da compra:

| Requisição | Quantidade | Tempo médio | 90% abaixo de | 95% abaixo de | Pior caso | Tempo só para abrir a conexão | Erros |
|---|---|---|---|---|---|---|---|
| 01_Home | 10709 | 496 ms | 594 ms | 726 ms | 1592 ms | 160 ms | 0.00% |
| 02_Buscar_Voos | 10708 | 318 ms | 394 ms | 430 ms | 959 ms | 0 ms | 0.00% |
| 03_Escolher_Voo | 10712 | 317 ms | 396 ms | 434 ms | 970 ms | 0 ms | 0.00% |
| 04_Finalizar_Compra | 10716 | 318 ms | 398 ms | 435 ms | 1014 ms | 0 ms | 0.00% |

**Resultado: o critério de aceitação foi atendido.**

A vazão ficou em 252.0 requisições por segundo, que é o que o critério pedia (pelo menos 250). O tempo de resposta de 90% das requisições ficou em 490 ms, dentro do limite de 2 segundos. Nenhuma requisição falhou, então todas as compras foram concluídas com sucesso.

