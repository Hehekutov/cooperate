#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5071}"
DATA_FILE="${DATA_FILE:-/tmp/cooperate-aspnet-smoke.json}"
LOG_FILE="${LOG_FILE:-/tmp/cooperate-aspnet-smoke.log}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

rm -f "${DATA_FILE}" "${LOG_FILE}"

ASPNETCORE_URLS="http://127.0.0.1:${PORT}" DATA_FILE="${DATA_FILE}" dotnet run --no-build >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    break
  fi

  sleep 0.5
done

HEALTH_RESPONSE="$(curl -fsS "http://127.0.0.1:${PORT}/health")"
REGISTER_RESPONSE="$(
  curl -fsS -X POST "http://127.0.0.1:${PORT}/api/auth/register-company" \
    -H 'Content-Type: application/json' \
    -d '{"companyName":"Acme","directorName":"Director One","phone":"+70000000111","password":"director123"}'
)"

echo "Health: ${HEALTH_RESPONSE}"
echo "Register: ${REGISTER_RESPONSE}"

if ! grep -q '"token"' <<<"${REGISTER_RESPONSE}"; then
  echo "Registration response does not contain a token" >&2
  echo "Server log:" >&2
  cat "${LOG_FILE}" >&2
  exit 1
fi
