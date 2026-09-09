#!/usr/bin/env node

/* eslint-disable no-restricted-syntax, onekey/no-raw-error -- standalone build script */

require('../../../development/env');

const fs = require('fs');
const path = require('path');

const AdmZip = require('adm-zip');

const extRoot = path.resolve(__dirname, '..');
const buildRoot = path.join(extRoot, 'build');
const developmentImageRoot = path.join(
  extRoot,
  'src',
  'assets',
  'img-development',
);
const distributionRoot = path.join(buildRoot, '_dist');
const developmentDistributionRoot = path.join(
  buildRoot,
  '_development_build_dist',
);

function recreateDirectory(directoryPath) {
  fs.rmSync(directoryPath, { force: true, recursive: true });
  fs.mkdirSync(directoryPath, { recursive: true });
}

function writeArchive(sourceRoot, archivePath) {
  const archive = new AdmZip();
  archive.addLocalFolder(sourceRoot);
  archive.writeZip(archivePath);
}

function copyDevelopmentImages(outputRoot) {
  for (const entry of fs.readdirSync(developmentImageRoot, {
    withFileTypes: true,
  })) {
    const sourcePath = path.join(developmentImageRoot, entry.name);
    const destinationPath = path.join(outputRoot, entry.name);
    fs.cpSync(sourcePath, destinationPath, {
      force: true,
      recursive: entry.isDirectory(),
    });
  }
}

function getDevelopmentVersion(version, buildNumber) {
  const versionParts = version.split('.');
  versionParts.pop();
  if (buildNumber.length <= 2) {
    return [...versionParts, '1', '1'].join('.');
  }

  const buildVersion = buildNumber.slice(2);
  const midpoint = Math.floor(buildVersion.length / 2);
  const firstPart = String(parseInt(buildVersion.slice(0, midpoint), 10));
  const secondPart = String(parseInt(buildVersion.slice(midpoint), 10));
  return [...versionParts, firstPart, secondPart].join('.');
}

function main() {
  recreateDirectory(distributionRoot);
  recreateDirectory(developmentDistributionRoot);

  const version = process.env.VERSION || require('../package.json').version;
  const buildNumber = process.env.BUILD_NUMBER || '11';
  const browser = 'chrome_v3-extension';
  const browserRoot = path.join(buildRoot, browser.replace(/-.+$/, ''));
  if (!fs.existsSync(path.join(browserRoot, 'manifest.json'))) {
    throw new Error(`Missing extension build output: ${browserRoot}`);
  }

  writeArchive(
    browserRoot,
    path.join(distributionRoot, `OneKey-Wallet-${version}-${browser}.zip`),
  );

  copyDevelopmentImages(browserRoot);
  const manifestPath = path.join(browserRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name = `${manifest.name} (DEVELOPMENT BUILD)`;
  manifest.version = getDevelopmentVersion(version, buildNumber);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  writeArchive(
    browserRoot,
    path.join(
      developmentDistributionRoot,
      `OneKey-Wallet-${version}-${browser}-development-build.zip`,
    ),
  );
}

main();
