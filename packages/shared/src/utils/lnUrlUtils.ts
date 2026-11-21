import { bech32 } from 'bech32';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import stringUtils from './stringUtils';

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
const LNURL_NUMBERED_LIST_MARKER =
  /(?:^|\r\n?|[\n\u2028\u2029])[^\S\r\n\u2028\u2029]*\d+\)(?=\s|$)/gu;
const LNURL_QUERY_CONTINUATION = /^[?&#]\S/u;
const LNURL_CLOSER_END = /[)>"'.,!?，。！？;；:：—]*(?=\s|$)/uy;
const LNURL_WRAPPER_CLOSERS: Record<string, string | undefined> = {
  '<': '>',
  '"': '"',
  "'": "'",
};

type IReusableLightningRecipient =
  | { kind: 'recipient'; address: string }
  | { kind: 'ambiguous' };

type IClosingParenthesis = {
  index: number;
  outer: IClosingParenthesis | undefined;
  count: number;
};

function indexClosingParentheses(text: string, ignoredClosers?: Set<number>) {
  const closers: IClosingParenthesis[] = [];
  const matching = new Map<number, IClosingParenthesis>();
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (text[index] === ')' && !ignoredClosers?.has(index)) {
      const outer = closers.at(-1);
      closers.push({ index, outer, count: (outer?.count ?? 0) + 1 });
    } else if (text[index] === '(') {
      const closer = closers.pop();
      if (closer) matching.set(index, closer);
    }
  }
  return matching;
}

function endsWithInlineClosers(input: string, count: number) {
  let end = input.length;
  while (end > 0 && /[.,!?，。！？]/u.test(input[end - 1])) end -= 1;
  return end >= count && input.endsWith(')'.repeat(count), end);
}

function readParenthesizedLnurl({
  address,
  tokenStart,
  tokenEnd,
  directEnd,
  enclosingDepth,
  firstCloser,
  hasUriContinuation,
}: {
  address: string;
  tokenStart: number;
  tokenEnd: number;
  directEnd: number;
  enclosingDepth: number;
  firstCloser: IClosingParenthesis | undefined;
  hasUriContinuation: boolean;
}): string | null {
  if (!firstCloser) return null;
  // Reserve closers for enclosing prose only when all openers can be paired.
  const reserved = firstCloser.count > enclosingDepth ? enclosingDepth : 0;
  let wrapperEnd: number | undefined;
  for (
    let closer: IClosingParenthesis | undefined = firstCloser;
    closer && closer.count > reserved;
    closer = closer.outer
  ) {
    const { index } = closer;
    if (!enclosingDepth && index >= directEnd) break;
    const next = address[index + 1];
    if (
      index >= tokenEnd ||
      !next ||
      /[\s.,!?，。！？;；:：)>"']/u.test(next)
    ) {
      // Prose on later lines can close enclosing parentheses but does not
      // supply the only evidence for the end of this URL.
      if (index >= directEnd && wrapperEnd === undefined) return null;
      const end = Math.min(index, tokenEnd);
      if (wrapperEnd !== undefined && wrapperEnd !== end) return null;
      wrapperEnd = end;
      if (end === tokenEnd) break;
    }
  }
  if (
    wrapperEnd === undefined ||
    (wrapperEnd === tokenEnd && hasUriContinuation)
  ) {
    return null;
  }
  return address.slice(tokenStart, wrapperEnd);
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
    /(^|[\s<("':：;；])((?:lightning:(?:\/\/)?)?(?:lnurl1[0-9a-z]+|lnurl[pwc]:[^\s<>"]+))(?=$|[\s>)"'.,!?，。！？;；])/gi,
  );
  const lineBreaks = address.matchAll(new RegExp(LNURL_LINE_BREAK.source, 'g'));
  let lineBreak = lineBreaks.next().value;
  let followingBreak = lineBreaks.next().value;
  let firstAfter = 0;
  let prefixCursor = 0;
  let enclosingDepth = 0;
  let closingParentheses: Map<number, IClosingParenthesis> | undefined;
  let closingWithoutListMarkers: Map<number, IClosingParenthesis> | undefined;
  let recipient: string | undefined;
  let recipientKey: string | undefined;
  for (const match of candidates) {
    const [, opener, input] = match;
    const tokenStart = match.index + opener.length;
    const tokenEnd = tokenStart + input.length;
    while (lineBreak && lineBreak.index < tokenEnd) {
      lineBreak = followingBreak;
      followingBreak = lineBreaks.next().value;
    }
    const lineEnd = lineBreak?.index ?? address.length;
    firstAfter = Math.max(firstAfter, tokenEnd);
    while (firstAfter < address.length && /\s/u.test(address[firstAfter])) {
      firstAfter += 1;
    }
    const noSameLineSuffix = firstAfter >= lineEnd;
    LNURL_CLOSER_END.lastIndex = firstAfter;
    const hasUriContinuation =
      LNURL_QUERY_CONTINUATION.test(
        address.slice(firstAfter, firstAfter + 2),
      ) ||
      (!noSameLineSuffix &&
        address.slice(tokenEnd, firstAfter).includes('\t') &&
        !LNURL_CLOSER_END.test(address));
    let candidate: string | undefined;
    if (
      opener === '(' &&
      LNURL_URI_SCHEME.test(normalizeLightningInput(input))
    ) {
      closingParentheses ??= indexClosingParentheses(address);
      while (prefixCursor < match.index) {
        const char = address[prefixCursor];
        if (LNURL_LINE_BREAK.test(char)) enclosingDepth = 0;
        else if (char === '(') enclosingDepth += 1;
        else if (char === ')' && enclosingDepth > 0) enclosingDepth -= 1;
        prefixCursor += 1;
      }
      LNURL_CLOSER_END.lastIndex = firstAfter + 1;
      const closesOnNextLine =
        noSameLineSuffix &&
        address[firstAfter] === ')' &&
        LNURL_CLOSER_END.test(address);
      const wrapper = {
        address,
        tokenStart,
        tokenEnd,
        directEnd: closesOnNextLine ? firstAfter + 1 : lineEnd,
        enclosingDepth,
        hasUriContinuation,
      };
      let uri = readParenthesizedLnurl({
        ...wrapper,
        firstCloser: closingParentheses.get(match.index),
      });
      if (
        !uri &&
        lineBreak &&
        noSameLineSuffix &&
        enclosingDepth > 0 &&
        endsWithInlineClosers(input, enclosingDepth + 1)
      ) {
        // A terminal run of closers can delimit the whole inline parenthetical
        // before a numbered list. Otherwise the later line can close the prose.
        if (!closingWithoutListMarkers) {
          const listClosers = new Set(
            Array.from(
              address.matchAll(LNURL_NUMBERED_LIST_MARKER),
              ({ index, 0: marker }) => index + marker.length - 1,
            ),
          );
          closingWithoutListMarkers = listClosers.size
            ? indexClosingParentheses(address, listClosers)
            : closingParentheses;
        }
        uri = readParenthesizedLnurl({
          ...wrapper,
          firstCloser: closingWithoutListMarkers.get(match.index),
        });
      }
      if (!uri) return { kind: 'ambiguous' };
      const normalized = normalizeLightningInput(uri);
      if (!findLnurl(normalized)) return { kind: 'ambiguous' };
      candidate = normalized;
    } else {
      // Strip adjacent prose only when the end of the wrapper identifies it.
      const closer = LNURL_WRAPPER_CLOSERS[opener];
      const token = input.replace(/[.,!?，。！？]+$/u, '');
      const closedInToken = closer && token.endsWith(closer);
      const uri = closedInToken ? token.slice(0, -1) : input;
      const normalized = normalizeLightningInput(uri);
      if (findLnurl(normalized)) candidate = normalized;
      if (candidate && LNURL_URI_SCHEME.test(candidate) && !closedInToken) {
        if (closer) {
          if (address[firstAfter] !== closer) {
            return { kind: 'ambiguous' };
          }
        } else {
          // A blank line can separate paragraphs outside an explicit wrapper.
          if (
            (noSameLineSuffix &&
              firstAfter < (followingBreak?.index ?? address.length)) ||
            hasUriContinuation
          ) {
            return { kind: 'ambiguous' };
          }
        }
      }
    }
    if (candidate !== undefined) {
      const key = candidate.replace(LNURL_URI_SCHEME, (scheme) =>
        scheme.toLowerCase(),
      );
      if (recipientKey !== undefined && recipientKey !== key) {
        return { kind: 'ambiguous' };
      }
      recipientKey = key;
      recipient ??= candidate;
    }
  }
  if (recipient !== undefined) return { kind: 'recipient', address: recipient };
}

export const parseReusableLightningRecipient = memoizee(
  (address: string): IReusableLightningRecipient | undefined => {
    const recipient = readReusableLightningRecipient(address);
    if (recipient || !LNURL_LINE_BREAK.test(address)) return recipient;

    const singleLine = stringUtils.stripLineBreaks(address);
    if (singleLine === address) return undefined;
    const joined = readReusableLightningRecipient(singleLine);
    // Clipboard cleanup can rejoin a verified Bech32 code, but a URI has no
    // checksum to confirm that joining its lines preserves the destination.
    if (
      joined?.kind === 'recipient' &&
      LNURL_URI_SCHEME.test(normalizeLightningInput(joined.address))
    ) {
      return { kind: 'ambiguous' };
    }
  },
  { max: 4, maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }) },
);

export function isAmbiguousLnurl(input: string): boolean {
  return (
    (LNURL_LINE_BREAK.test(input) || /lnurl(?:[pwc]:|1)/i.test(input)) &&
    parseReusableLightningRecipient(input)?.kind === 'ambiguous'
  );
}
