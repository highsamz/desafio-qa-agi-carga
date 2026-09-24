### Teste de carga

Teste executado em 24/09/2026 às 20:06. Olhei só o trecho em que a carga já estava no nível cheio: de 130s a 710s do teste, ou seja 580 segundos e 146256 requisições. As subidas e descidas de carga ficam de fora da conta.

| O que foi medido | Resultado | O que eu precisava | Situação |
|---|---|---|---|
| Requisições por segundo | 252.2 | pelo menos 250 | passou |
| Tempo de resposta em que 90% das requisições ficaram abaixo | 5513 ms | menos de 2000 ms | não passou |
| Requisições com erro | 1.33% | no máximo 1.0% | não passou |
| Requisições por segundo, menor e maior valor | 220 e 284 | — | — |
| Compras finalizadas com sucesso | 36104 (62.2 por segundo) | — | — |

Detalhe de cada requisição da compra:

| Requisição | Quantidade | Tempo médio | 90% abaixo de | 95% abaixo de | Pior caso | Tempo só para abrir a conexão | Erros |
|---|---|---|---|---|---|---|---|
| 01_Home | 36540 | 2016 ms | 5772 ms | 8110 ms | 11129 ms | 258 ms | 1.37% |
| 02_Buscar_Voos | 36559 | 1732 ms | 5362 ms | 7719 ms | 10731 ms | 0 ms | 1.36% |
| 03_Escolher_Voo | 36577 | 1744 ms | 5426 ms | 7819 ms | 10800 ms | 0 ms | 1.27% |
| 04_Finalizar_Compra | 36580 | 1755 ms | 5498 ms | 7789 ms | 11930 ms | 0 ms | 1.30% |

Erros que mais apareceram:

- `429` Texto esperado nao encontrado: Welcome to the Simple Travel Agency! — 501 vezes
- `429` Texto esperado nao encontrado: Choose This Flight — 498 vezes
- `429` Texto esperado nao encontrado: Thank you for your purchase today! — 475 vezes
- `429` Texto esperado nao encontrado: has been reserved — 466 vezes
- `500` Texto esperado nao encontrado: Thank you for your purchase today! — 1 vezes

**Resultado: o critério de aceitação não foi atendido.**

A vazão ficou em 252.2 requisições por segundo, que é o que o critério pedia (pelo menos 250). O tempo de resposta de 90% das requisições foi de 5513 ms, acima do limite de 2 segundos. A taxa de erro foi de 1.33%, acima do limite de 1.0% que eu considerei aceitável.

