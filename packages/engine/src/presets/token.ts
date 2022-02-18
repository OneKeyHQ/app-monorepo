import {
  TokenList,
  evmAllTokenList,
  solAllTokenList,
} from '@onekeyfe/default-token-list';
import axios from 'axios';

import { Token } from '../types/token';

import { REMOTE_URL, Version, checkVersion, parseVersion } from './base';

let preset: Record<string, TokenList> = {
  evm: evmAllTokenList,
  sol: solAllTokenList,
};
let synced = true; // Change to false to enable remote updating
//  network.id => token_address => Token
let presetTokens: Record<string, Record<string, Token>> = {};

function initTokenList(presetToken: Record<string, TokenList>) {
  const r: Record<string, Record<string, Token>> = {};
  Object.keys(presetToken).forEach((impl) => {
    presetToken[impl].tokens.forEach((t) => {
      const networkId = `${impl}--${t.chainId}`;
      if (typeof r[networkId] === 'undefined') {
        r[networkId] = {};
      }
      const tokenAddress = t.address.toLowerCase();
      const token: Token = {
        id: '',
        name: t.name,
        networkId,
        tokenIdOnNetwork: tokenAddress,
        symbol: t.symbol,
        decimals: t.decimals,
        logoURI: t.logoURI || '',
      };
      r[networkId][tokenAddress] = token;
    });
  });
  presetTokens = r;
}

initTokenList(preset);

const getTokenkListVersion = (r: Record<string, TokenList>): Version => {
  const keys = Object.keys(r);
  if (keys && keys.length > 0) {
    return r[keys[0]].version;
  }
  return parseVersion('0.0.0');
};

async function syncTokenList(
  ver: Version,
  impls: string[],
): Promise<Record<string, TokenList> | null> {
  const newVer: string = await checkVersion(
    `${REMOTE_URL}/tokenlists/version`,
    ver,
  );
  if (newVer === '') {
    return null;
  }

  // from remote
  const remoteList: Record<string, TokenList> = {};
  try {
    console.log('get remote token list...');
    for (let i = 0; i < impls.length; i += 1) {
      const impl = impls[i];
      const response = await axios.get<TokenList>(
        `${REMOTE_URL}/tokenlists/${impl}.all.json`,
      );
      remoteList[impl] = response.data;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
  return remoteList;
}

async function syncLatestTokenList() {
  if (synced) {
    return;
  }
  const newTokenList = await syncTokenList(getTokenkListVersion(preset), [
    'evm',
    'sol',
  ]);
  if (newTokenList) {
    preset = newTokenList;
    initTokenList(newTokenList);
  }
  synced = true;
}

(async () => {
  await syncLatestTokenList();
})();

function getPresetToken(networkId: string, tokenIdOnNetwork: string): Token {
  return (
    (presetTokens[networkId] || {})[tokenIdOnNetwork] || {
      id: `${networkId}--${tokenIdOnNetwork}`,
      name: tokenIdOnNetwork.slice(0, 4),
      networkId,
      tokenIdOnNetwork,
      symbol: tokenIdOnNetwork.slice(0, 4),
      decimals: -1,
      logoURI: '',
    }
  );
}

function getPresetTokensOnNetwork(networkId: string): Token[] {
  return Object.values(presetTokens[networkId] || {});
}

export { getPresetToken, getPresetTokensOnNetwork };
