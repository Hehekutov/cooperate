#!/bin/sh
set -eu

dotnet /app/backend/Backend.dll &

exec nginx -g 'daemon off;'
