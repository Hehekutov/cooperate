#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/output/test-reports"
BACKEND_PORT="${BACKEND_PORT:-3101}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
TEST_RUN_ID="${TEST_RUN_ID:-$(date +%s)}"
BACKEND_STORAGE_MODE="${BACKEND_STORAGE_MODE:-db}"
DATABASE_SCHEMA="${DATABASE_SCHEMA:-cooperate_test_${TEST_RUN_ID}}"
DATA_FILE="${DATA_FILE:-/tmp/cooperate-test-${TEST_RUN_ID}.json}"
BACKEND_LOG="${OUTPUT_DIR}/backend.log"
FRONTEND_LOG="${OUTPUT_DIR}/frontend.log"
BACKEND_REPORT="${OUTPUT_DIR}/backend-integration.json"
PERF_REPORT="${OUTPUT_DIR}/backend-perf.json"
E2E_REPORT="${OUTPUT_DIR}/frontend-e2e.json"

mkdir -p "${OUTPUT_DIR}"

BACKEND_PID=""
FRONTEND_PID=""

assert_port_is_free() {
  local port="$1"
  local label="$2"

  if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "${label} port ${port} is already in use" >&2
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >&2 || true
    exit 1
  fi
}

cleanup() {
  local exit_code="$?"

  if [[ -n "${FRONTEND_PID}" ]]; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
    wait "${FRONTEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${BACKEND_PID}" ]]; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi

  if [[ "${BACKEND_STORAGE_MODE}" == "file" ]]; then
    rm -f "${DATA_FILE}"
  elif [[ -f "${ROOT_DIR}/Backend/.env" ]]; then
    (
      cd "${ROOT_DIR}"
      dotnet run --project Backend/Backend.csproj -- drop-schema "${DATABASE_SCHEMA}" >/dev/null 2>&1 || true
    )
  fi

  return "${exit_code}"
}

trap cleanup EXIT

echo "==> Backend build"
dotnet build "${ROOT_DIR}/Backend/Backend.csproj"

echo "==> Frontend checks"
npm --prefix "${ROOT_DIR}/Frotend" run build
npm --prefix "${ROOT_DIR}/Frotend" run lint
npm --prefix "${ROOT_DIR}/Frotend" run typecheck

echo "==> Browser runtime"
npm --prefix "${ROOT_DIR}/Frotend/cooperate" run e2e:install-browser

assert_port_is_free "${BACKEND_PORT}" "Backend"
assert_port_is_free "${FRONTEND_PORT}" "Frontend"

if [[ "${BACKEND_STORAGE_MODE}" == "file" ]]; then
  echo "==> Start backend (file store: ${DATA_FILE})"
else
  echo "==> Start backend (${DATABASE_SCHEMA})"
fi
(
  cd "${ROOT_DIR}"
  if [[ "${BACKEND_STORAGE_MODE}" == "file" ]]; then
    ASPNETCORE_URLS="http://127.0.0.1:${BACKEND_PORT}" \
    DATA_FILE="${DATA_FILE}" \
    CORS_ORIGIN="http://127.0.0.1:${FRONTEND_PORT}" \
    dotnet run --project Backend/Backend.csproj --no-build
  else
    ASPNETCORE_URLS="http://127.0.0.1:${BACKEND_PORT}" \
    DATABASE_SCHEMA="${DATABASE_SCHEMA}" \
    CORS_ORIGIN="http://127.0.0.1:${FRONTEND_PORT}" \
    dotnet run --project Backend/Backend.csproj --no-build
  fi
) >"${BACKEND_LOG}" 2>&1 &
BACKEND_PID="$!"

node "${ROOT_DIR}/scripts/wait-for-health.mjs" --url "http://127.0.0.1:${BACKEND_PORT}/health"

echo "==> Backend integration"
BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
TEST_RUN_ID="${TEST_RUN_ID}" \
REPORT_FILE="${BACKEND_REPORT}" \
node "${ROOT_DIR}/Backend/scripts/api-test.mjs"

echo "==> Start frontend"
(
  cd "${ROOT_DIR}/Frotend/cooperate"
  VITE_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
  npm run dev -- --host 127.0.0.1 --port "${FRONTEND_PORT}" --strictPort
) >"${FRONTEND_LOG}" 2>&1 &
FRONTEND_PID="$!"

node "${ROOT_DIR}/scripts/wait-for-health.mjs" --url "http://127.0.0.1:${FRONTEND_PORT}/"

echo "==> Frontend E2E"
node "${ROOT_DIR}/Frotend/cooperate/scripts/e2e.mjs" \
  --base-url "http://127.0.0.1:${FRONTEND_PORT}" \
  --report "${E2E_REPORT}"

echo "==> Backend perf"
BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
TEST_RUN_ID="${TEST_RUN_ID}" \
REPORT_FILE="${PERF_REPORT}" \
node "${ROOT_DIR}/Backend/scripts/perf-check.mjs"

echo "==> Reports"
echo "${BACKEND_REPORT}"
echo "${E2E_REPORT}"
echo "${PERF_REPORT}"
