#!/usr/bin/env node

/* eslint-disable no-continue, no-restricted-syntax, onekey/no-raw-error -- standalone build script */

const fs = require('fs');
const path = require('path');

const compilerNames = ['pages', 'background', 'content-script'];
const buildRoot = path.resolve(__dirname, '..', 'build');

function getBrowser() {
  const browserArg = process.argv.find((arg) => arg.startsWith('--browser='));
  if (browserArg) {
    return browserArg.slice('--browser='.length);
  }
  const browserIndex = process.argv.indexOf('--browser');
  if (browserIndex >= 0 && process.argv[browserIndex + 1]) {
    return process.argv[browserIndex + 1];
  }
  return process.env.EXT_CHANNEL || 'chrome';
}

function assertInsideBuildRoot(targetPath) {
  const relativePath = path.relative(buildRoot, targetPath);
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      `Refusing to modify path outside build root: ${targetPath}`,
    );
  }
}

function removeDirectory(targetPath) {
  assertInsideBuildRoot(targetPath);
  fs.rmSync(targetPath, { force: true, recursive: true });
}

function copyDirectory(sourceRoot, destinationRoot) {
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const destinationPath = path.join(destinationRoot, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destinationPath, { recursive: true });
      copyDirectory(sourcePath, destinationPath);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported staged asset type: ${sourcePath}`);
    }
    if (fs.existsSync(destinationPath)) {
      const source = fs.readFileSync(sourcePath);
      const destination = fs.readFileSync(destinationPath);
      if (source.equals(destination)) {
        continue;
      }
      throw new Error(`Conflicting compiler output: ${destinationPath}`);
    }
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function main() {
  const outputFolder = `${getBrowser()}_v3`;
  const stagingRoot = path.join(buildRoot, '.rspack', outputFolder);
  const finalRoot = path.join(buildRoot, outputFolder);
  const temporaryRoot = path.join(buildRoot, `.finalize-${outputFolder}`);

  removeDirectory(temporaryRoot);
  fs.mkdirSync(temporaryRoot, { recursive: true });

  try {
    for (const compilerName of compilerNames) {
      const compilerRoot = path.join(stagingRoot, compilerName);
      if (!fs.existsSync(compilerRoot)) {
        throw new Error(`Missing Rspack compiler output: ${compilerRoot}`);
      }
      copyDirectory(compilerRoot, temporaryRoot);
    }

    removeDirectory(finalRoot);
    fs.renameSync(temporaryRoot, finalRoot);

    if (process.env.EXT_KEEP_RSPACK_STAGING !== '1') {
      removeDirectory(stagingRoot);
      const rspackRoot = path.dirname(stagingRoot);
      if (
        fs.existsSync(rspackRoot) &&
        fs.readdirSync(rspackRoot).length === 0
      ) {
        removeDirectory(rspackRoot);
      }
    }
  } catch (error) {
    removeDirectory(temporaryRoot);
    throw error;
  }

  console.log(`Finalized extension assets in ${finalRoot}`);
}

main();
