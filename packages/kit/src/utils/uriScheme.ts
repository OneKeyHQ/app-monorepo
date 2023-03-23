import { parse } from 'url';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

function parseBitcoinUri(uriScheme: string): {
  address: string;
  amount?: string;
  label?: string;
  message?: string;
} {
  try {
    const uri = new URL(uriScheme);
    const address = uri.pathname;
    const amount = uri.searchParams.get('amount') || '';
    const label = uri.searchParams.get('label') || '';
    const message = uri.searchParams.get('message') || '';
    return { address, amount, label, message };
  } catch (error) {
    throw new Error(`parseBitcoinUri : ${uriScheme}`);
  }
}

function parseEthereumUri(uriScheme: string): {
  address: string;
  contractAddress?: string;
  data?: string;
  gas?: string;
} {
  try {
    const uri = new URL(uriScheme);
    const address = uri.pathname;
    const contractAddress = uri.searchParams.get('contractAddress') || '';
    const data = uri.searchParams.get('data') || '';
    const gas = uri.searchParams.get('gas') || '';
    return { address, contractAddress, data, gas };
  } catch (error) {
    throw new Error(`parseEthereumUri : ${uriScheme}`);
  }
}

export function parseUriScheme(uriScheme: string) {
  try {
    const { protocol } = parse(uriScheme);
    if (protocol === 'bitcoin:' || protocol === 'bitcoincash:') {
      const info = parseBitcoinUri(uriScheme);
      return { ...info, protocol };
    }
    if (protocol === 'ethereum:') {
      const info = parseEthereumUri(uriScheme);
      return { ...info, protocol };
    }
    return false;
  } catch (error) {
    debugLogger.common.error(error);
    return false;
  }
}
