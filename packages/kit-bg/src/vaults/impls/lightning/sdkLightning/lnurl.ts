import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import axios from 'axios';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { bech32Decode } from './bech32';

import type { IInvoiceDecodedResponse } from '../types/invoice';
import type {
  ILNURLAuthServiceResponse,
  ILNURLDetails,
  ILNURLError,
  ILNURLPaymentInfo,
} from '../types/lnurl';

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

export const isLNURLRequestError = (
  res: ILNURLError | ILNURLDetails,
): res is ILNURLError =>
  'status' in res && res.status.toUpperCase() === 'ERROR';

export const getLnurlDetails = memoizee(
  async (lnurl: string): Promise<ILNURLDetails> => {
    const url = parseLnurl(lnurl);
    const searchParamsTag = url.searchParams.get('tag');
    const searchParamsK1 = url.searchParams.get('k1');
    const searchParamsAction = url.searchParams.get('action');

    if (searchParamsTag && searchParamsTag === 'login' && searchParamsK1) {
      const lnurlAuthDetails: ILNURLAuthServiceResponse = {
        ...(searchParamsAction && { action: searchParamsAction }),
        domain: url.hostname,
        k1: searchParamsK1,
        tag: searchParamsTag,
        url: url.toString(),
      };

      return lnurlAuthDetails;
    }

    try {
      const res = await axios.get<ILNURLDetails | ILNURLError>(url.toString());
      const lnurlDetails = res.data;
      if (isLNURLRequestError(lnurlDetails)) {
        throw new Error(`LNURL request error: ${lnurlDetails.reason}`);
      }
      lnurlDetails.domain = url.hostname;
      lnurlDetails.url = url.toString();

      return lnurlDetails;
    } catch (e) {
      throw new Error(`Invalid LNURL: ${e instanceof Error ? e.message : ''}`);
    }
  },
  {
    promise: true,
    maxAge: timerUtils.getTimeDurationMs({ seconds: 3 }),
  },
);

export const verifyInvoice = ({
  decodedInvoice,
  paymentInfo,
  metadata,
  amount,
}: {
  decodedInvoice: IInvoiceDecodedResponse;
  paymentInfo: ILNURLPaymentInfo;
  metadata: string;
  amount: number;
}) => {
  let metadataHash = '';
  try {
    const dataToHash = metadata;
    metadataHash = bytesToHex(sha256(dataToHash));
  } catch (e) {
    console.error(e);
    throw e;
  }

  const purposeCommitHash = decodedInvoice.tags.find(
    (t) => t.tagName === 'purpose_commit_hash',
  )?.data;

  switch (true) {
    case purposeCommitHash !== metadataHash: // LN WALLET Verifies that h tag (description_hash) in provided invoice is a hash of metadata string converted to byte array in UTF-8 encoding
    case decodedInvoice.millisatoshis !== String(amount):
    case paymentInfo.successAction &&
      !['url', 'message', 'aes'].includes(paymentInfo.successAction.tag):
      return false;
    default:
      return true;
  }
};

export function getPathSuffix(domain: string, privateKeyHex: string) {
  const derivationMaterial = bytesToHex(
    hmac(
      sha256,
      Buffer.from(domain, 'utf-8'),
      Buffer.from(privateKeyHex, 'hex'),
    ),
  );

  const buf = Buffer.from(derivationMaterial, 'hex');

  const pathSuffix = [];
  for (let i = 0; i < 4; i += 1) {
    pathSuffix.push(buf.readUInt32BE(i * 4));
  }
  return pathSuffix;
}
