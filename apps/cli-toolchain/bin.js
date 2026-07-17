#!/usr/bin/env node

const path = require('node:path');

const tsupManifestPath = require.resolve('tsup/package.json');
require(path.join(path.dirname(tsupManifestPath), 'dist', 'cli-default.js'));
