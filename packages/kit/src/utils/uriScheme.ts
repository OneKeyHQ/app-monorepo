import { parse } from 'url';

function parseBitcoinUri(uriScheme: string) {
  const uri = new URL(uriScheme);
  const address = uri.pathname;
  const amount = uri.searchParams.get('amount') || '';
  const label = uri.searchParams.get('label') || '';
  const message = uri.searchParams.get('message') || '';
  return { address, amount, label, message };
}

function parseEthereumUri(uriScheme: string) {
  const uri = new URL(uriScheme);
  const address = uri.pathname;
  const contractAddress = uri.searchParams.get('contractAddress') || '';
  const data = uri.searchParams.get('data') || '';
  const gas = uri.searchParams.get('gas') || '';
  return { address, contractAddress, data, gas };
}

export function parseUriScheme(uriScheme: string) {
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
}
