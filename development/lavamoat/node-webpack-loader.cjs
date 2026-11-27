// cspell:ignore lavamoat

const fs = require('node:fs');
const path = require('node:path');

const { LavaMoatError } = require('./error.cjs');
const {
  getNodeBuildState,
  matches,
  namespaceParameter,
} = require('./node-webpack.cjs');

module.exports = function transformNodeModule(contents) {
  const callback = this.async();
  const { stateId } = this.getOptions();
  const { buildOptions, loads, esbuildPath, nativeFiles } =
    getNodeBuildState(stateId);
  const esbuild = require(esbuildPath);
  const namespace =
    new URLSearchParams(this.resourceQuery.slice(1)).get(namespaceParameter) ||
    'file';
  const args = { path: this.resourcePath, namespace, suffix: '' };
  (async () => {
    let result;
    // Match the real resource again: matchResource, query strings, and inline
    // loader syntax cannot declare a new native capability boundary.
    const nativeRequest = nativeFiles.has(this.resourcePath)
      ? nativeFiles.get(fs.realpathSync(this.resourcePath))
      : undefined;
    if (nativeRequest) {
      if (namespace !== 'file')
        throw new LavaMoatError(
          'Native boundaries cannot select a build namespace',
        );
      result = {
        contents: `module.exports = require(${JSON.stringify(nativeRequest)});`,
        loader: 'js',
      };
    }
    for (const entry of loads) {
      if (result) break;
      result = matches(entry.options, args)
        ? await entry.callback(args)
        : undefined;
      if (result) break;
    }
    if (result?.errors?.length)
      throw new LavaMoatError(JSON.stringify(result.errors));
    if (namespace !== 'file' && !result)
      throw new LavaMoatError(`Missing trusted Node shim: ${namespace}`);
    const extension = path.extname(this.resourcePath);
    const loader =
      result?.loader ||
      buildOptions.loader?.[extension] ||
      { '.ts': 'ts', '.tsx': 'tsx', '.json': 'json', '.jsx': 'jsx' }[
        extension
      ] ||
      'js';
    const transformed = await esbuild.build({
      stdin: {
        contents: result?.contents ?? contents,
        loader,
        sourcefile: this.resourcePath,
        resolveDir: result?.resolveDir || path.dirname(this.resourcePath),
      },
      bundle: false,
      write: false,
      tsconfig:
        buildOptions.tsconfig &&
        path.resolve(
          buildOptions.absWorkingDir || process.cwd(),
          buildOptions.tsconfig,
        ),
      target: buildOptions.target,
      define: buildOptions.define,
      drop: buildOptions.drop,
      format: loader === 'json' ? 'cjs' : undefined,
      sourcemap: false,
    });
    callback(null, transformed.outputFiles[0].text);
  })().catch(callback);
};
