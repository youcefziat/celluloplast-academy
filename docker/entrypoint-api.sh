#!/bin/sh
set -e

if [ "${SKIP_DB_SETUP}" = "true" ]; then
  echo "Skipping database setup (SKIP_DB_SETUP=true)."
else
  echo "Running database setup..."
  if [ "${SEED_DEMO}" = "true" ]; then
    pnpm --filter @cio/db db:setup:seed
  else
    pnpm --filter @cio/db db:setup
  fi
  echo "Database setup complete."
fi

echo "Starting API..."
exec pnpm --filter @cio/api start
