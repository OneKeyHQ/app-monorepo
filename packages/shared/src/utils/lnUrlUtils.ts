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

const SUPPORTED_INVOICE_PREFIX = /^ln(bc|tb)(\d+[munp]?)?$/;

export function getLightningInvoiceNetwork(
  address: string,
): 'mainnet' | 'testnet' | undefined {
  const invoice = bech32.decodeUnsafe(address, address.length);
  const prefix = SUPPORTED_INVOICE_PREFIX.exec(invoice?.prefix ?? '')?.[1];
  if (prefix) {
    return prefix === 'tb' ? 'testnet' : 'mainnet';
  }
}

export const isReusableLightningRecipient = (input?: string): boolean => {
  if (!input) return false;
  return isLightningAddress(input) || !!findLnurl(input);
};

const LNURL_URI_SCHEME = /^lnurl[pwc]:/i;
const LNURL_LINE_BREAK = /\r\n?|[\n\u2028\u2029]/;
const LNURL_WRAPPER_CLOSERS: Record<string, string | undefined> = {
  '<': '>',
  '"': '"',
  "'": "'",
};

type IReusableLightningRecipient =
  | { kind: 'recipient'; address: string }
  | { kind: 'ambiguous' };

function readParenthesizedLnurl(
  prefix: string,
  input: string,
  suffix: string,
  sameLine: string,
): string | null {
  const text =
    input +
    (!sameLine.trim() && suffix.trimStart().startsWith(')') ? ')' : sameLine);
  let enclosingDepth = 0;
  for (const char of prefix) {
    if (char === '(') enclosingDepth += 1;
    if (char === ')' && enclosingDepth > 0) enclosingDepth -= 1;
  }

  const unmatchedClosers: number[] = [];
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      if (depth > 0) {
        depth -= 1;
      } else {
        unmatchedClosers.push(index);
      }
    }
  }
  // Reserve closers for enclosing prose only when all openers can be paired.
  const linkCloserCount =
    unmatchedClosers.length > enclosingDepth
      ? unmatchedClosers.length - enclosingDepth
      : unmatchedClosers.length;
  let wrapperEnd: number | undefined;
  for (const index of unmatchedClosers.slice(0, linkCloserCount)) {
    const next = text[index + 1];
    if (
      index >= input.length ||
      !next ||
      /[\s.,!?，。！？;；:：)>"']/u.test(next)
    ) {
      const end = Math.min(index, input.length);
      if (wrapperEnd !== undefined && wrapperEnd !== end) return null;
      wrapperEnd = end;
    }
  }
  return wrapperEnd === undefined ? null : input.slice(0, wrapperEnd);
}

function readReusableLightningRecipient(
  address: string,
): IReusableLightningRecipient | undefined {
  if (isReusableLightningRecipient(address)) {
    return { kind: 'recipient', address };
  }
  const standaloneLines = normalizeLightningInput(address)
    .trim()
    .split(LNURL_LINE_BREAK);
  if (
    standaloneLines[1]?.trim() &&
    /^lnurl[pwc]:\S+$/i.test(standaloneLines.join(''))
  ) {
    return { kind: 'ambiguous' };
  }
  // Payment text can contain an LNURL as a separate token. Keep QR detection
  // strict so a scan cannot interpret arbitrary text as a payment.
  const candidates = address.matchAll(
    /(^|[\s<("':：])((?:lightning:(?:\/\/)?)?(?:lnurl1[0-9a-z]+|lnurl[pwc]:[^\s<>"]+))(?=$|[\s>)"'.,!?，。！？])/gi,
  );
  for (const match of candidates) {
    const [matchedText, opener, input] = match;
    const suffix = address.slice(match.index + matchedText.length);
    const [sameLine, followingLine = ''] = suffix.split(LNURL_LINE_BREAK, 2);
    if (
      opener === '(' &&
      LNURL_URI_SCHEME.test(normalizeLightningInput(input))
    ) {
      const prefix =
        address.slice(0, match.index).split(LNURL_LINE_BREAK).at(-1) ?? '';
      const uri = readParenthesizedLnurl(prefix, input, suffix, sameLine);
      const candidate = uri && normalizeLightningInput(uri);
      return candidate && findLnurl(candidate)
        ? { kind: 'recipient', address: candidate }
        : { kind: 'ambiguous' };
    }
    // Strip adjacent prose only when the end of the wrapper identifies it.
    const closer = LNURL_WRAPPER_CLOSERS[opener];
    const token = input.replace(/[.,!?，。！？]+$/u, '');
    const closedInToken = closer && token.endsWith(closer);
    const uri = closedInToken ? token.slice(0, -1) : input;
    const candidate = normalizeLightningInput(uri);
    if (findLnurl(candidate)) {
      if (LNURL_URI_SCHEME.test(candidate) && !closedInToken) {
        if (closer) {
          if (!suffix.trimStart().startsWith(closer)) {
            return { kind: 'ambiguous' };
          }
        } else {
          // A blank line can separate paragraphs outside an explicit wrapper.
          if (
            !sameLine.trim() &&
            (followingLine.trim() || /^[?&#]\S/u.test(suffix.trimStart()))
          ) {
            return { kind: 'ambiguous' };
          }
        }
      }
      return { kind: 'recipient', address: candidate };
    }
  }
}

export function isAmbiguousLnurl(input: string): boolean {
  return (
    /lnurl[pwc]:/i.test(input) &&
    readReusableLightningRecipient(input)?.kind === 'ambiguous'
  );
}

export const resolveReusableLightningRecipient = (input: string) => {
  const result = readReusableLightningRecipient(input);
  return result?.kind === 'recipient' ? result.address : null;
};
