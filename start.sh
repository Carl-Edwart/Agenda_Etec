#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d "node_modules" ] || [ ! -x "./node_modules/.bin/electron" ]; then
    echo "Installing dependencies..."
    npm install
fi
./node_modules/.bin/electron .