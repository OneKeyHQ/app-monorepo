import {
  TokenList,
  evmAllTokenList,
  nearAllTokenList,
  solAllTokenList,
} from '@onekeyfe/default-token-list';
import axios from 'axios';

import { IMPL_EVM, IMPL_NEAR, IMPL_SOL } from '../constants';
import { Token } from '../types/token';

import { REMOTE_URL, Version, checkVersion, parseVersion } from './base';

const caseSensitiveImpls = new Set([IMPL_SOL]);

let preset: Record<string, TokenList> = {
  [IMPL_EVM]: evmAllTokenList,
  [IMPL_SOL]: solAllTokenList,
  [IMPL_NEAR]: nearAllTokenList,
};
let synced = true; // Change to false to enable remote updating
//  network.id => token_address => Token
let presetTokens: Record<string, Map<string, Token>> = {};

function initTokenList(presetToken: Record<string, TokenList>) {
  const r: Record<string, Map<string, Token>> = {};
  Object.keys(presetToken).forEach((impl) => {
    presetToken[impl].tokens.forEach((t) => {
      const networkId = `${impl}--${t.chainId}`;
      if (typeof r[networkId] === 'undefined') {
        r[networkId] = new Map<string, Token>();
      }
      const tokenAddress = caseSensitiveImpls.has(impl)
        ? t.address
        : t.address.toLowerCase();
      const token: Token = {
        id: '',
        name: t.name,
        networkId,
        tokenIdOnNetwork: tokenAddress,
        symbol: t.symbol,
        decimals: t.decimals,
        logoURI: t.logoURI || '',
      };
      r[networkId].set(tokenAddress, token);
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
    IMPL_EVM,
    IMPL_SOL,
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

function getPresetToken(
  networkId: string,
  tokenIdOnNetwork: string,
): Token | undefined {
  let tokens = presetTokens[networkId];
  if (typeof tokens === 'undefined') {
    tokens = new Map<string, Token>();
  }
  return tokens.get(tokenIdOnNetwork);
}

function getPresetTokensOnNetwork(networkId: string): Token[] {
  const tokens = presetTokens[networkId];
  if (typeof tokens === 'undefined') {
    return [];
  }
  const res: Token[] = [];
  tokens.forEach((value) => {
    res.push(value);
  });
  return res;
}

export { getPresetToken, getPresetTokensOnNetwork };
