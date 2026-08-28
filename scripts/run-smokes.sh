#!/usr/bin/env bash
# ============================================================================
# Corre las baterías de smokes contra Postgres.
#
# Cada suite va envuelta en begin/rollback: la base queda intacta y se pueden
# correr todas seguidas sin resetear entre medias. Eso es lo que permite
# correrlas también contra un ambiente desplegado sin dejar rastro.
#
# Dos modos, según de dónde salga la conexión:
#   - LOCAL (por defecto): docker exec contra el contenedor de `supabase start`.
#   - REMOTO: si MVSE_DB_URL está definida, psql directo contra esa URL. Lo usa
#     el pipeline para verificar staging DESPUÉS de desplegarlo.
#
# Uso:
#   ./scripts/run-smokes.sh                 todas
#   ./scripts/run-smokes.sh voto            solo las que contengan "voto"
#   ./scripts/run-smokes.sh --detail        muestra la salida completa
#   MVSE_DB_URL=postgres://… ./scripts/run-smokes.sh    contra una base remota
#
# Se copia el .sql al contenedor con `docker cp` en vez de mandarlo por stdin:
# por stdin se corrompen los acentos y todo el proyecto está en español.
# ============================================================================
set -uo pipefail

# Git Bash reescribe /tmp/... a una ruta de Windows antes de que llegue al
# contenedor, y psql termina buscando el archivo en C:\Users\...\Temp.
# Con la conversión apagada hay que pasar el ORIGEN como ruta relativa (si no,
# docker cp recibe /c/Users/... que Windows no entiende), por eso el cd de abajo.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

CONTAINER="${MVSE_DB_CONTAINER:-supabase_db_mivotoseescucha}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILTRO=""
DETALLE=0

for arg in "$@"; do
  case "$arg" in
    -d|--detail) DETALLE=1 ;;
    -h|--help) sed -n '2,16p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) FILTRO="$arg" ;;
  esac
done

# Orden deliberado: primero los motores, al final los de punta a punta.
SUITES=(
  smoke-territorio
  smoke-rls
  smoke-voto
  smoke-orden
  smoke-pedidos
  smoke-panel
  smoke-portal
  smoke-canales
  smoke-catalogo
)

DB_URL="${MVSE_DB_URL:-}"

# Cada modo resuelve a su manera dos cosas: contar tablas y correr un .sql.
if [ -n "$DB_URL" ]; then
  DESTINO="remoto"
  contar_tablas() {
    psql "$DB_URL" -tAc \
      "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null || echo 0
  }
  # Sin docker cp de por medio: psql lee el archivo del propio disco, así que
  # los acentos llegan intactos sin pasar por stdin.
  correr_suite() { psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/$1.sql" 2>&1; }
else
  DESTINO="local ($CONTAINER)"
  if ! docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q .; then
    echo "✗ El contenedor ${CONTAINER} no está corriendo."
    echo "  Levántalo con: pnpm supabase start"
    echo "  O apunta a una base remota con MVSE_DB_URL=postgres://…"
    exit 1
  fi
  contar_tablas() {
    docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
      "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null || echo 0
  }
  correr_suite() {
    local copia
    copia=$(cd "$DIR" && docker cp "$1.sql" "${CONTAINER}:/tmp/$1.sql" 2>&1)
    if [ -n "$copia" ]; then echo "no se pudo copiar: $copia"; return 1; fi
    docker exec "$CONTAINER" psql -U postgres -d postgres -q \
      -v ON_ERROR_STOP=1 -f "/tmp/$1.sql" 2>&1
  }
fi

TABLAS=$(contar_tablas)
if [ "${TABLAS:-0}" -lt 10 ]; then
  echo "✗ La base no tiene esquema (solo ${TABLAS} tablas) — destino: ${DESTINO}."
  if [ -n "$DB_URL" ]; then
    echo "  Revisa que MVSE_DB_URL apunte a donde crees y que el despliegue haya migrado."
  else
    echo "  Aplica las migraciones con: pnpm supabase db reset"
  fi
  exit 1
fi

echo "Destino: ${DESTINO}"

TOTAL_OK=0
TOTAL_FALLA=0
SUITES_ROJAS=0
SUITES_VACIAS=0
INICIO=$SECONDS

for s in "${SUITES[@]}"; do
  [ -n "$FILTRO" ] && [[ "$s" != *"$FILTRO"* ]] && continue
  [ -f "$DIR/$s.sql" ] || continue

  SALIDA=$(correr_suite "$s")
  CODIGO=$?

  OK=$(printf '%s' "$SALIDA" | grep -c 'PASS *|' || true)
  FALLA=$(printf '%s' "$SALIDA" | grep -Ec '(FALLA|FAIL) *\|' || true)
  TOTAL_OK=$((TOTAL_OK + OK))
  TOTAL_FALLA=$((TOTAL_FALLA + FALLA))

  if [ "$CODIGO" -eq 0 ] && [ "$((OK + FALLA))" -eq 0 ]; then
    # Un verde vacío no es un verde: si no contó nada, algo se rompió antes.
    printf '  \033[33m● VACÍA\033[0m  %-24s sin comprobaciones\n' "$s"
    SUITES_VACIAS=$((SUITES_VACIAS + 1))
    [ "$DETALLE" -eq 1 ] && printf '%s\n' "$SALIDA"
  elif [ "$CODIGO" -eq 0 ] && [ "$FALLA" -eq 0 ]; then
    printf '  \033[32m● VERDE\033[0m  %-24s %s comprobaciones\n' "$s" "$OK"
    [ "$DETALLE" -eq 1 ] && printf '%s\n' "$SALIDA"
  else
    printf '  \033[31m● ROJA \033[0m  %-24s %s en verde, %s en rojo\n' "$s" "$OK" "$FALLA"
    SUITES_ROJAS=$((SUITES_ROJAS + 1))
    printf '%s\n' "$SALIDA" | grep -E '(FALLA|FAIL) *\||ERROR|ERROR:' | head -25
  fi
done

DURACION=$((SECONDS - INICIO))
echo ""
if [ "$SUITES_ROJAS" -eq 0 ] && [ "$SUITES_VACIAS" -eq 0 ]; then
  printf '\033[32mBatería completa en verde: %s comprobaciones en %ss\033[0m\n' "$TOTAL_OK" "$DURACION"
  exit 0
fi
printf '\033[31m%s suites rojas, %s vacías — %s en verde, %s en rojo (%ss)\033[0m\n' \
  "$SUITES_ROJAS" "$SUITES_VACIAS" "$TOTAL_OK" "$TOTAL_FALLA" "$DURACION"
exit 1
