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
  require('child_process').execSync('yarn app:web-embed:build', {
    stdio: 'inherit',
  });
  exit(0);
}

// GitHub Actions
if (process.env.process.env.GITHUB_SHA) {
  exit(0);
}

// Local development
if (!fs.existsSync(webBuildPath)) {
  require('child_process').execSync('yarn app:web-embed:build', {
    stdio: 'inherit',
  });
  require('child_process').execSync(
    `node ${path.resolve(
      BASEDIR,
      '../../../apps/mobile/plugins/linkWebEmbed.js',
    )}`,
    {
      stdio: 'inherit',
    },
  );
}
