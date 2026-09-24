#!/usr/bin/env python3
"""
Avalia o critério de aceitação a partir do arquivo de resultados do JMeter (.jtl em CSV).

Critério: vazão >= ALVO req/s  E  percentil 90 do tempo de resposta < P90_MAX ms
          (premissa adicional: taxa de erro <= ERRO_MAX %, pois o cenário exige "passagem comprada com sucesso").

A vazão é medida apenas na JANELA DE ESTABILIDADE (platô de carga ou platô do pico),
excluindo rampas — a média do teste inteiro (tabela "Statistics" do dashboard) sempre
fica abaixo do alvo por incluir a subida e a descida.

Uso:
  python3 scripts/avaliar_criterio.py resultados.jtl --inicio 130 --fim 710
  (inicio/fim em segundos, relativos à primeira amostra)

Códigos de saída: 0 = critério atendido, 3 = critério não atendido, 1 = erro de execução.
"""
import argparse
import csv
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime

ROTULO_COMPRA = "04_Finalizar_Compra"
CRITERIO_NAO_ATENDIDO = 3


def percentil(valores, p):
    if not valores:
        return float("nan")
    ordenados = sorted(valores)
    k = max(0, math.ceil(p / 100 * len(ordenados)) - 1)  # nearest-rank
    return ordenados[k]


def mediana(valores):
    return percentil(valores, 50)


def main():
    # O relatório é gravado em UTF-8 mesmo quando o console do Windows usa cp1252.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("jtl")
    ap.add_argument("--inicio", type=float, default=0, help="início da janela (s)")
    ap.add_argument("--fim", type=float, default=None, help="fim da janela (s)")
    ap.add_argument("--alvo-rps", type=float, default=250)
    ap.add_argument("--p90-max", type=float, default=2000)
    ap.add_argument("--erro-max", type=float, default=1.0, help="%% máximo de erros")
    ap.add_argument("--titulo", default="Resultado")
    a = ap.parse_args()

    with open(a.jtl, newline="", encoding="utf-8", errors="replace") as f:
        linhas = list(csv.DictReader(f))
    if not linhas:
        sys.exit("JTL vazio.")

    t0 = min(int(l["timeStamp"]) for l in linhas)
    ini_ms = t0 + a.inicio * 1000
    fim_ms = t0 + a.fim * 1000 if a.fim is not None else max(int(l["timeStamp"]) for l in linhas)
    janela = [l for l in linhas if ini_ms <= int(l["timeStamp"]) < fim_ms]
    dur = (fim_ms - ini_ms) / 1000
    if not janela or dur <= 0:
        sys.exit("Nenhuma amostra na janela informada.")

    tempos = [int(l["elapsed"]) for l in janela]
    erros = [l for l in janela if l["success"].lower() != "true"]
    por_seg = Counter(int((int(l["timeStamp"]) - ini_ms) // 1000) for l in janela)
    serie = [por_seg.get(s, 0) for s in range(int(dur))]
    compras_ok = sum(1 for l in janela if l["label"] == ROTULO_COMPRA and l["success"].lower() == "true")

    rps = len(janela) / dur
    p90 = percentil(tempos, 90)
    taxa_erro = 100 * len(erros) / len(janela)

    ok_rps = rps >= a.alvo_rps
    ok_p90 = p90 < a.p90_max
    ok_err = taxa_erro <= a.erro_max
    aprovado = ok_rps and ok_p90 and ok_err

    def s(b):
        return "passou" if b else "não passou"

    quando = datetime.fromtimestamp(t0 / 1000).strftime("%d/%m/%Y às %H:%M")

    out = []
    out.append(f"### {a.titulo}\n")
    out.append(f"Teste executado em {quando}. Olhei só o trecho em que a carga já estava no nível cheio: "
               f"de {a.inicio:.0f}s a {a.inicio + dur:.0f}s do teste, ou seja {dur:.0f} segundos e "
               f"{len(janela)} requisições. As subidas e descidas de carga ficam de fora da conta.\n")
    out.append("| O que foi medido | Resultado | O que eu precisava | Situação |")
    out.append("|---|---|---|---|")
    out.append(f"| Requisições por segundo | {rps:.1f} | pelo menos {a.alvo_rps:.0f} | {s(ok_rps)} |")
    out.append(f"| Tempo de resposta em que 90% das requisições ficaram abaixo | {p90:.0f} ms | "
               f"menos de {a.p90_max:.0f} ms | {s(ok_p90)} |")
    out.append(f"| Requisições com erro | {taxa_erro:.2f}% | no máximo {a.erro_max:.1f}% | {s(ok_err)} |")
    out.append(f"| Requisições por segundo, menor e maior valor | {min(serie)} e {max(serie)} | — | — |")
    out.append(f"| Compras finalizadas com sucesso | {compras_ok} ({compras_ok / dur:.1f} por segundo) | — | — |")
    out.append("")
    out.append("Detalhe de cada requisição da compra:\n")

    tem_connect = "Connect" in janela[0]
    cab = "| Requisição | Quantidade | Tempo médio | 90% abaixo de | 95% abaixo de | Pior caso |"
    sep = "|---|---|---|---|---|---|"
    if tem_connect:
        cab += " Tempo só para abrir a conexão |"
        sep += "---|"
    cab += " Erros |"
    sep += "---|"
    out.append(cab)
    out.append(sep)

    grupos = defaultdict(list)
    for l in janela:
        grupos[l["label"]].append(l)
    for rot in sorted(grupos):
        g = grupos[rot]
        t = [int(x["elapsed"]) for x in g]
        e = sum(1 for x in g if x["success"].lower() != "true")
        linha = (f"| {rot} | {len(g)} | {sum(t) / len(t):.0f} ms | {percentil(t, 90):.0f} ms | "
                 f"{percentil(t, 95):.0f} ms | {max(t)} ms |")
        if tem_connect:
            linha += f" {mediana([int(x['Connect']) for x in g]):.0f} ms |"
        linha += f" {100 * e / len(g):.2f}% |"
        out.append(linha)

    if erros:
        out.append("\nErros que mais apareceram:\n")
        for (cod, msg), n in Counter((l["responseCode"], (l.get("failureMessage") or l["responseMessage"])[:90])
                                     for l in erros).most_common(5):
            out.append(f"- `{cod}` {msg} — {n} vezes")

    out.append("\n**Resultado: o critério de aceitação "
               f"{'foi atendido' if aprovado else 'não foi atendido'}.**\n")
    motivos = []
    if ok_rps:
        motivos.append(f"A vazão ficou em {rps:.1f} requisições por segundo, que é o que o critério pedia "
                       f"(pelo menos {a.alvo_rps:.0f}).")
    else:
        motivos.append(f"A vazão ficou em {rps:.1f} requisições por segundo, abaixo das {a.alvo_rps:.0f} pedidas.")
    if ok_p90:
        motivos.append(f"O tempo de resposta de 90% das requisições ficou em {p90:.0f} ms, "
                       f"dentro do limite de {a.p90_max / 1000:.0f} segundos.")
    else:
        motivos.append(f"O tempo de resposta de 90% das requisições foi de {p90:.0f} ms, "
                       f"acima do limite de {a.p90_max / 1000:.0f} segundos.")
    if taxa_erro == 0:
        motivos.append("Nenhuma requisição falhou, então todas as compras foram concluídas com sucesso.")
    elif ok_err:
        motivos.append(f"A taxa de erro foi de {taxa_erro:.2f}%, dentro do que eu aceitei ({a.erro_max:.1f}%).")
    else:
        motivos.append(f"A taxa de erro foi de {taxa_erro:.2f}%, acima do limite de {a.erro_max:.1f}% "
                       "que eu considerei aceitável.")
    out.append(" ".join(motivos) + "\n")

    print("\n".join(out))
    sys.exit(0 if aprovado else CRITERIO_NAO_ATENDIDO)


if __name__ == "__main__":
    main()
