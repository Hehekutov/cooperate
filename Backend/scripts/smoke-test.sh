#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-5071}"
SCHEMA_SUFFIX="$(date +%s)"
DATABASE_SCHEMA="${DATABASE_SCHEMA:-cooperate_smoke_${SCHEMA_SUFFIX}}"
DATA_FILE="${DATA_FILE:-/tmp/cooperate-smoke-${SCHEMA_SUFFIX}.json}"
LOG_FILE="${LOG_FILE:-/tmp/cooperate-aspnet-smoke-${SCHEMA_SUFFIX}.log}"
BASE_URL="http://127.0.0.1:${PORT}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi

  (
    cd "${ROOT_DIR}"
    dotnet run --project Backend/Backend.csproj -- drop-schema "${DATABASE_SCHEMA}" >/dev/null 2>&1 || true
  )
}

trap cleanup EXIT

rm -f "${LOG_FILE}"

(
  cd "${ROOT_DIR}"
  ASPNETCORE_URLS="${BASE_URL}" \
  DATABASE_SCHEMA="${DATABASE_SCHEMA}" \
  DATA_FILE="${DATA_FILE}" \
  dotnet run --project Backend/Backend.csproj --no-build
) >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
    break
  fi

  sleep 0.5
done

HEALTH_RESPONSE="$(curl -fsS "${BASE_URL}/health")"
REGISTER_RESPONSE="$(
  curl -fsS -X POST "${BASE_URL}/api/auth/register-company" \
    -H 'Content-Type: application/json' \
    -d '{
      "companyName":"Smoke Corp",
      "companyInn":"7701234567",
      "companyDescription":"Smoke flow",
      "directorName":"Director Smoke",
      "directorLogin":"director-smoke",
      "directorPosition":"Director",
      "phone":"+70000000111",
      "password":"director123"
    }'
)"

echo "Health: ${HEALTH_RESPONSE}"
echo "Register: ${REGISTER_RESPONSE}"
echo "Schema: ${DATABASE_SCHEMA}"
echo "Data file: ${DATA_FILE}"

if ! grep -q '"token"' <<<"${REGISTER_RESPONSE}"; then
  echo "Registration response does not contain a token" >&2
  echo "Server log:" >&2
  cat "${LOG_FILE}" >&2
  exit 1
fi
