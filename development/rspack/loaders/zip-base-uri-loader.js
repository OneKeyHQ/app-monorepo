/* eslint-disable no-restricted-syntax, onekey/no-raw-error -- webpack loader */
module.exports = function zipBaseUriLoader(source) {
  const expression = 'baseURI: import.meta.url';
  if (source.split(expression).length !== 2) {
    throw new Error(
      'zip.js baseURI initialization changed; review the runtime URL mapping.',
    );
  }
  return source.replace(expression, 'baseURI: import.meta.rspackBaseUri');
};
