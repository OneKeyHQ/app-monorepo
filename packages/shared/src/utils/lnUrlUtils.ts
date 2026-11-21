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

    // oxlint-disable-next-line @cspell/spellchecker
    return `https://${host}/.well-known/lnurlp/${name}`;
  }
  return null;
};

const _parseLnurl = (lnurl: string) => {
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
    const input = text.trim();
    const url = /^lnurl[pwc]:(\S+)$/i.exec(input)?.[1];
    if (url) {
      return url;
    }
    const decoded = /^lnurl1/i.test(input)
      ? bech32.decodeUnsafe(input, 2000)
      : undefined;
    return decoded?.prefix === 'lnurl' && decoded.words.length ? input : null;
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
  },
);

// BOLT 11 recommends `lightning:` as the URI prefix of an invoice. It says not
// to use `lightning://`, which some generators emit anyway.
const LIGHTNING_URI_SCHEME = /^lightning:(\/\/)?/i;
// QR codes carry bech32 in upper case. A bech32 string is either all lower or
// all upper case, so a mixed case one is left as is for the decoder to reject.
const UPPER_CASE_BECH32 = /^LN[0-9A-Z]+$/;

export const hasLightningUriScheme = (input: string) =>
  LIGHTNING_URI_SCHEME.test(input.trim());

export const normalizeLightningInput = (input: string): string => {
  const payload = input.trim().replace(LIGHTNING_URI_SCHEME, '');
  return UPPER_CASE_BECH32.test(payload) ? payload.toLowerCase() : payload;
};

export const isReusableLightningRecipient = (input?: string): boolean => {
  if (!input) return false;
  return isLightningAddress(input) || !!findLnurl(input);
};

export const resolveReusableLightningRecipient = (address: string) => {
  if (isReusableLightningRecipient(address)) {
    return address;
  }
  // Payment text can contain an LNURL as a separate token. Keep QR detection
  // strict so a scan cannot interpret arbitrary text as a payment.
  const candidates = address.matchAll(
    /(^|[\s<("'])((?:lightning:(?:\/\/)?)?(?:lnurl1[0-9a-z]+|lnurl[pwc]:[^\s<>"]+))(?=$|[\s>)"'.,!?，。！？])/gi,
  );
  for (const [, opener, input] of candidates) {
    // The token already stops at double quotes and angle brackets.
    const token =
      opener === '"' || opener === '<'
        ? input
        : input.replace(/[.,!?，。！？]+$/u, '');
    const closer = opener === '(' ? ')' : "'";
    const uri =
      (opener === '(' || opener === "'") && token.endsWith(closer)
        ? token.slice(0, -1)
        : token;
    const candidate = normalizeLightningInput(uri);
    if (findLnurl(candidate)) {
      return candidate;
    }
  }
  return null;
};
