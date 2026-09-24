#!/usr/bin/env bash
# Executa o teste em modo CLI, gera o dashboard HTML e avalia o critério de aceitação.
# Uso: ./scripts/run.sh [carga|pico|smoke]
set -euo pipefail

TESTE="${1:-carga}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JMETER="${JMETER:-${JMETER_HOME:+$JMETER_HOME/bin/}jmeter}"
# No Git Bash o lancador Unix do JMeter nao resolve o java.exe do Windows; o .bat resolve.
if [ "${OS:-}" = "Windows_NT" ] && [ -f "${JMETER}.bat" ]; then
  JMETER="${JMETER}.bat"
fi
export HEAP="${HEAP:--Xms1g -Xmx4g}"

# Parâmetros (podem ser sobrescritos por variáveis de ambiente)
RATE="${RATE:-3780}"            # compras/min (3780 = 63/s x 4 req = 252 req/s; meta 250 + ~1% de margem)
RAMPUP="${RAMPUP:-2}"           # min
DURACAO="${DURACAO:-10}"        # min
ALVO_RPS="${ALVO_RPS:-250}"

calc() { awk "BEGIN { printf \"%.0f\", $1 }"; }

case "$TESTE" in
  carga)
    JMX="teste-carga.jmx"
    PROPS=(-Jrate="$RATE" -Jrampup="$RAMPUP" -Jduracao="$DURACAO")
    INI=$(calc "$RAMPUP*60 + 10"); FIM=$(calc "($RAMPUP+$DURACAO)*60 - 10") ;;
  pico)
    JMX="teste-pico.jmx"
    PROPS=(-Jrate_pico="$RATE")
    INI=165; FIM=335 ;;              # platô do pico: 160s a 340s (margem de 5s)
  smoke)
    JMX="teste-carga.jmx"            # validação funcional rápida: 1 compra/s por 1 min
    PROPS=(-Jrate=60 -Jrampup=0.25 -Jduracao=1 -Jrampdown=0.25)
    INI=20; FIM=70; ALVO_RPS=4 ;;
  *) echo "Uso: $0 [carga|pico|smoke]"; exit 2 ;;
esac

OUT="$ROOT/resultados/$TESTE-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

echo ">> Executando $JMX -> $OUT"
"$JMETER" -n -t "$ROOT/tests/$JMX" \
  -q "$ROOT/config/relatorio.properties" \
  "${PROPS[@]}" \
  -l "$OUT/resultados.jtl" -j "$OUT/jmeter.log" \
  -e -o "$OUT/dashboard"

echo ">> Avaliando critério de aceitação (janela ${INI}s-${FIM}s)"
PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || PY=python

set +e
"$PY" "$ROOT/scripts/avaliar_criterio.py" "$OUT/resultados.jtl" \
  --inicio "$INI" --fim "$FIM" --alvo-rps "$ALVO_RPS" --p90-max 2000 \
  --titulo "Teste de $TESTE" | tee "$OUT/avaliacao.md"
STATUS=${PIPESTATUS[0]}
set -e

echo ">> Dashboard: $OUT/dashboard/index.html"

# A avaliacao e o entregavel do teste: relatorio vazio significa que ela falhou,
# e isso nao pode passar despercebido (era o que o antigo "|| true" escondia).
if [ ! -s "$OUT/avaliacao.md" ]; then
  echo "ERRO: a avaliacao nao gerou relatorio ($OUT/avaliacao.md esta vazio)." >&2
  exit 1
fi

case "$STATUS" in
  0) echo ">> Criterio de aceitacao atendido." ;;
  3) echo ">> Criterio de aceitacao NAO atendido - ver $OUT/avaliacao.md" ;;
  *) echo "ERRO: avaliar_criterio.py falhou (codigo $STATUS)." >&2; exit 1 ;;
esac
