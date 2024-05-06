#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { exit } = require('process');

const BASEDIR = path.dirname(__filename);
const webBuildPath = path.resolve(
  BASEDIR,
  '../../../packages/web-embed/web-build',
);

// EAS build
if (process.env.EAS_BUILD) {
  console.log('build web-embed on EAS_BUILD');
  require('child_process').execSync('yarn app:web-embed:build', {
    stdio: 'inherit',
  });
  exit(0);
}

// GitHub Actions
if (process.env.GITHUB_SHA) {
  console.log('No need to compile web-embed');
  exit(0);
}

// Local development
if (!fs.existsSync(webBuildPath)) {
  console.log('build web-embed on local development');
  require('child_process').execSync('yarn app:web-embed:build', {
    stdio: 'inherit',
  });
}
