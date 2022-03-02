export const shortenAddress = (address: string, chars = 4) => {
  if (!address) {
    return address;
  }
  const prevOffset = address.startsWith('0x') ? chars + 2 : chars;
  return `${address.slice(0, prevOffset)}...${address.slice(-chars)}`;
};

export const CDN_PREFIX = 'https://onekey-asset.com/';
