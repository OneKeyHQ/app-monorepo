export const shortenAddress = (address: string, chars = 4) => {
  if (!address) {
    return address;
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

export const CDN_PREFIX = 'https://onekey-asset.com/';
