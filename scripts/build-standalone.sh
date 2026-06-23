#!/usr/bin/env sh
set -eu

npm run build
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
