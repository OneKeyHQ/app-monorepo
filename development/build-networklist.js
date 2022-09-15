const networkList = require('@onekeyfe/network-list/build/onekey.networklist.json');
const prettier = require('prettier');
const fs = require('fs');

const networkCodeIdPairs = {};
networkList.networks.forEach((network) => {
  networkCodeIdPairs[network.shortcode] = network.id;
});

const output = `export const OnekeyNetwork = ${JSON.stringify(
  networkCodeIdPairs,
  null,
  2,
)} as const;\n`;

prettier.resolveConfig('.prettierrc.js').then((options) => {
  const formatted = prettier.format(output, {
    ...options,
    parser: 'typescript',
  });
  fs.writeFileSync('packages/engine/src/presets/networkIds.ts', formatted);
});
