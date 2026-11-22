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

// BOLT 11 recommends `lightning:` as the URI prefix of an invoice. It says not
// to use `lightning://`, which some generators emit anyway.
const LIGHTNING_URI_SCHEME = /^lightning:(\/\/)?/i;
// QR codes carry bech32 in upper case. A bech32 string is either all lower or
// all upper case, so a mixed case one is left as is for the decoder to reject.
const UPPER_CASE_BECH32 = /^LN[0-9A-Z]+$/;

export const hasLightningUriScheme = (input: string) =>
  LIGHTNING_URI_SCHEME.test(input.trim());

// Reduces what a user scans or pastes to the bare invoice, LNURL or lightning
// address it carries.
export const normalizeLightningInput = (input: string): string => {
  const payload = input.trim().replace(LIGHTNING_URI_SCHEME, '');
  return UPPER_CASE_BECH32.test(payload) ? payload.toLowerCase() : payload;
};

export function getLightningInvoiceNetwork(
  address: string,
): 'mainnet' | 'testnet' | undefined {
  if (!/^ln(?:bc|tb)[0-9a-z]+$/i.test(address)) return;
  const invoice = bech32.decodeUnsafe(address, address.length);
  const network = /^ln(bc|tb)(\d+[munp]?)?$/.exec(invoice?.prefix ?? '')?.[1];
  // BOLT 11 requires a seven-word timestamp and a 104-word signature.
  if (network && invoice && invoice.words.length >= 111) {
    return network === 'tb' ? 'testnet' : 'mainnet';
  }
}

export function isLnurlCode(address: string): boolean {
  if (/^lnurl[pwc]:\S+$/i.test(address)) return true;
  if (!/^lnurl1[0-9a-z]+$/i.test(address)) return false;
  const decoded = bech32.decodeUnsafe(address, 2000);
  return decoded?.prefix === 'lnurl' && decoded.words.length > 0;
}

export const isReusableLightningRecipient = (input?: string): boolean => {
  if (!input) return false;
  return isLightningAddress(input) || !!findLnurl(input);
};
