const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');

const API_URL = 'https://wallet.onekeytest.com/wallet/v1/network/list/all';
const OUTPUT_FILE = 'packages/shared/src/config/presetNetworks.ts';

function sanitizeShortcode(shortcode) {
  return shortcode.replace(/[-_]/g, '');
}

function stringifyWithSingleQuotes(obj, space = 2) {
  const json = JSON.stringify(obj, null, space);
  return json.replace(/"([^"]+)":/g, "'$1':").replace(/"/g, "'");
}

async function fetchNetworks() {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      fs.unlinkSync(OUTPUT_FILE);
      console.log(`Deleted old ${OUTPUT_FILE}`);
    }

    const response = await axios.get(API_URL);
    const networks = response.data.data;

    if (!Array.isArray(networks) || !networks.length) {
      console.error('Networks is empty');
      return;
    }

    console.log('====>>>networks: ', networks);

    let fileContent = `/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable spellcheck/spell-checker */
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { ENetworkStatus } from '@onekeyhq/shared/types';

import platformEnv from '../platformEnv';

// dangerNetwork represents a virtual network
export const dangerAllNetworkRepresent: IServerNetwork = {
  'chainId': '0',
  'code': 'onekeyall',
  'decimals': 0,
  'id': 'onekeyall--0',
  'impl': 'onekeyall',
  'isTestnet': false,
  'isAllNetworks': true,
  'logoURI': 'https://uni.onekey-asset.com/static/logo/chain_selector_logo.png',
  'name': 'All Networks',
  'shortcode': 'onekeyall',
  'shortname': 'onekeyall',
  'symbol': 'ALL NETWORKS',
  'feeMeta': {
    'code': '',
    'decimals': 0,
    'symbol': '0',
  },
  'defaultEnabled': true,
  'status': ENetworkStatus.LISTED,
};
`;

    // Group networks by impl
    const networkGroups = {};
    networks.forEach((network) => {
      const { impl, shortcode } = network;
      if (!shortcode) return;

      if (!networkGroups[impl]) {
        networkGroups[impl] = [];
      }
      networkGroups[impl].push(network);
    });

    const networkMap = new Map();
    const networkDeclarations = [];

    Object.keys(networkGroups)
      .sort()
      .forEach((impl) => {
        networkDeclarations.push(`// ${impl.toUpperCase()} networks`);

        networkGroups[impl].forEach((network) => {
          const { shortcode } = network;
          if (!shortcode) return;

          const sanitizedShortcode = sanitizeShortcode(shortcode);
          if (network.status === 'LISTED') {
            network.status = 'ENetworkStatus.LISTED';
          } else {
            network.status = 'ENetworkStatus.TRASH';
          }

          const networkString = stringifyWithSingleQuotes(network).replace(
            /'(ENetworkStatus\.(LISTED|TRASH))'/g,
            '$1',
          );

          const networkDeclaration = `const ${sanitizedShortcode}: IServerNetwork = ${networkString};`;

          networkDeclarations.push(networkDeclaration);
          networkMap.set(sanitizedShortcode, network);
        });
      });

    fileContent += networkDeclarations.join('\n\n');

    fileContent += `

const chainsOnlyEnabledInDev: IServerNetwork[] = [
  // Add your dev-only chains here
];

export const presetNetworksMap = {
  ${Array.from(networkMap.keys()).join(',\n  ')}
};

export const getPresetNetworks = memoFn((): IServerNetwork[] => [
  dangerAllNetworkRepresent,
  ${Array.from(networkMap.keys()).join(',\n  ')},
  ...(platformEnv.isDev ? chainsOnlyEnabledInDev : []),
]);
`;
    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`${OUTPUT_FILE} has been generated successfully.`);

    // Run ESLint fix command
    exec(`npx eslint --fix ${OUTPUT_FILE}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running ESLint: ${error}`);
        return;
      }
      console.log(`ESLint fix completed for ${OUTPUT_FILE}`);
    });
  } catch (error) {
    console.error('Error fetching networks:', error.message);
  }
}

fetchNetworks();
