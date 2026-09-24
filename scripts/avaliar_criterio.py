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
"""
import argparse
import csv
import math
import sys
from collections import Counter, defaultdict

ROTULO_COMPRA = "04_Finalizar_Compra"


def percentil(valores, p):
    if not valores:
        return float("nan")
    ordenados = sorted(valores)
    k = max(0, math.ceil(p / 100 * len(ordenados)) - 1)  # nearest-rank
    return ordenados[k]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jtl")
    ap.add_argument("--inicio", type=float, default=0, help="início da janela (s)")
    ap.add_argument("--fim", type=float, default=None, help="fim da janela (s)")
    ap.add_argument("--alvo-rps", type=float, default=250)
    ap.add_argument("--p90-max", type=float, default=2000)
    ap.add_argument("--erro-max", type=float, default=1.0, help="% máximo de erros")
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
        return "✅" if b else "❌"

    out = []
    out.append(f"### {a.titulo}\n")
    out.append(f"Janela analisada: {a.inicio:.0f}s a {a.inicio + dur:.0f}s ({dur:.0f}s de platô) — {len(janela)} requisições\n")
    out.append("| Métrica | Resultado | Meta | Status |")
    out.append("|---|---|---|---|")
    out.append(f"| Vazão média (req/s) | {rps:.1f} | ≥ {a.alvo_rps:.0f} | {s(ok_rps)} |")
    out.append(f"| Vazão por segundo (mín / máx) | {min(serie)} / {max(serie)} | — | — |")
    out.append(f"| Tempo de resposta p90 (ms) | {p90:.0f} | < {a.p90_max:.0f} | {s(ok_p90)} |")
    out.append(f"| Taxa de erro | {taxa_erro:.2f}% | ≤ {a.erro_max:.1f}% | {s(ok_err)} |")
    out.append(f"| Compras concluídas com sucesso | {compras_ok} ({compras_ok / dur:.1f}/s) | — | — |")
    out.append("")
    out.append("| Requisição | Amostras | Média (ms) | p90 (ms) | p95 (ms) | Máx (ms) | Erros |")
    out.append("|---|---|---|---|---|---|---|")
    grupos = defaultdict(list)
    for l in janela:
        grupos[l["label"]].append(l)
    for rot in sorted(grupos):
        g = grupos[rot]
        t = [int(x["elapsed"]) for x in g]
        e = sum(1 for x in g if x["success"].lower() != "true")
        out.append(f"| {rot} | {len(g)} | {sum(t) / len(t):.0f} | {percentil(t, 90):.0f} | "
                   f"{percentil(t, 95):.0f} | {max(t)} | {100 * e / len(g):.2f}% |")
    if erros:
        out.append("\nPrincipais erros:\n")
        for (cod, msg), n in Counter((l["responseCode"], (l.get("failureMessage") or l["responseMessage"])[:90])
                                     for l in erros).most_common(5):
            out.append(f"- `{cod}` {msg} — {n}x")
    out.append(f"\n**Critério de aceitação: {'SATISFEITO ✅' if aprovado else 'NÃO SATISFEITO ❌'}**\n")
    print("\n".join(out))
    sys.exit(0 if aprovado else 1)


if __name__ == "__main__":
    main()
