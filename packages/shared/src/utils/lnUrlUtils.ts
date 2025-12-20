import { bech32 } from 'bech32';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function bech32Decode(
  input: string,
  encoding: BufferEncoding = 'utf-8',
) {
  const { words: data } = bech32.decode(input, 2000);
  const byteData = bech32.fromWords(data);
  return Buffer.from(byteData).toString(encoding);
}

const parseLightingAddress = (emailAddress: string) => {
  if (
    emailAddress.match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-_0-9]+\.)+[a-zA-Z]{2,}))$/,
    )
  ) {
    let [name, host] = emailAddress.split('@');
    // remove invisible characters %EF%B8%8F
    name = name.replace(/[^ -~]+/g, '');
    host = host.replace(/[^ -~]+/g, '');
    // eslint-disable-next-line spellcheck/spell-checker
    return `https://${host}/.well-known/lnurlp/${name}`;
  }
  return null;
};

const parseLnurl = (lnurl: string) => {
  try {
    const decodedUrl = bech32Decode(lnurl);
    return new URL(decodedUrl);
  } catch (e) {
    console.info('ignoring bech32 parsing error', e);
  }

  const urlFromAddress = parseLightingAddress(lnurl);
  if (urlFromAddress) {
    return new URL(urlFromAddress);
  }

  return new URL(`https://${lnurl.replace(/^lnurl[pwc]/i, '')}`);
};

export const isLightningAddress = (address?: string) => {
  if (!address) return false;
  return Boolean(parseLightingAddress(address));
};

export const findLnurl = memoizee(
  (text: string) => {
    const trimmedText = text.trim();
    let match;

    // protocol scheme
    match = trimmedText.match(/lnurl[pwc]:(\S+)/i);
    if (match) {
      return match[1];
    }

    // bech32
    match = trimmedText.match(/(lnurl[a-zA-HJ-NP-Z0-9]+)/i);
    if (match) {
      return match[1];
    }

    return null;
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
  },
);
