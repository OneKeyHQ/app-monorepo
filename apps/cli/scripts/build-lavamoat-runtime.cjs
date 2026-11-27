// cspell:ignore lavamoat

const fs = require('node:fs/promises');
const path = require('node:path');

const esbuild = require('esbuild');

const { createBuildOptions } = require('../esbuild.config');

const {
  assertNoDeprecatedBufferConstructors,
} = require('./assert-no-deprecated-buffer');

// This source entry and esbuild's JavaScript dependencies are loaded separately
// by @lavamoat/node. The esbuild executable remains an explicit native boundary.
module.exports = async function buildCli({ outputPath }) {
  const options = createBuildOptions({ watch: false });
  const destination = path.resolve(outputPath);
  await fs.mkdir(destination, { recursive: true });
  await esbuild.build({
    ...options,
    outfile: path.join(destination, 'cli.js'),
  });
  assertNoDeprecatedBufferConstructors(path.join(destination, 'cli.js'));
};
