#!/usr/bin/env bash
set -euo pipefail

# Transpile the source from src to dist folder
babel -d dist/ src/

# Copy TypeScript declaration files
cp src/*.d.ts dist/

# Make sure the published CLI is executable
chmod +x dist/cli.js
