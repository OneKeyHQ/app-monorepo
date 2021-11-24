export const shortenAddress = (address: string, chars = 4) => {
  if (!address) {
    throw Error(`Invalid 'address' parameter '${address}'.`);
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};
