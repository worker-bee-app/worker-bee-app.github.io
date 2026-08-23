#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_VERSION="v20.11.1"
NODE_OS="darwin"
NODE_ARCH="arm64"
NODE_DIR="$SCRIPT_DIR/.node"

echo "Running localized UI tests for Worker Bee..."

# 1. Download Local Node.js if it doesn't exist
if [ ! -d "$NODE_DIR" ]; then
    echo "Downloading isolated Node.js $NODE_VERSION for macOS $NODE_ARCH..."
    curl -fsSLO --compressed "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$NODE_OS-$NODE_ARCH.tar.xz"
    
    echo "Extracting Node.js..."
    mkdir -p "$NODE_DIR"
    tar -xJf "node-$NODE_VERSION-$NODE_OS-$NODE_ARCH.tar.xz" -C "$NODE_DIR" --strip-components=1
    rm "node-$NODE_VERSION-$NODE_OS-$NODE_ARCH.tar.xz"
    echo "Isolated Node.js successfully installed at $NODE_DIR"
else
    echo "Isolated Node.js already exists."
fi

# 2. Add local Node.js to PATH
export PATH="$NODE_DIR/bin:$PATH"
echo "Using Node version: $(node -v)"
echo "Using NPM version: $(npm -v)"

# 3. Install Playwright Dependencies
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "Installing NPM dependencies..."
    npm install
fi

echo "Ensuring Playwright browsers are installed..."
npx playwright install chromium webkit

# 4. Run Playwright Tests
echo "Running End-to-End Tests..."
npx playwright test "$@"
