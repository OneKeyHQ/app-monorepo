// cspell:ignore LavaMoat lavamoat

const { LavaMoatError } = require('../lavamoat/error.cjs');

module.exports = function extensionWorkerLoader(source) {
  const { name } = this.getOptions();
  const match =
    /^export default function Worker_fn\(\) \{\n  return new Worker\(__webpack_public_path__ \+ "((?:pages|background|content-script)\.[a-f0-9]{10}\.worker\.js)"\);\n\}\n$/.exec(
      source,
    );
  if (
    !['pages', 'background', 'content-script'].includes(name) ||
    !match ||
    !match[1].startsWith(`${name}.`)
  ) {
    throw new LavaMoatError(
      'Packaged worker factory changed; review the extension worker URL adapter',
    );
  }
  // LavaMoat deliberately omits require.p. MV3 workers always use the existing
  // same-origin root path, independent of the caller's page or compartment.
  return source.replace(
    `__webpack_public_path__ + "${match[1]}"`,
    JSON.stringify(`/${match[1]}`),
  );
};
