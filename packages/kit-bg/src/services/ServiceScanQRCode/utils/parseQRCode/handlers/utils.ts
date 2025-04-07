import qs from 'querystring';

export const isPayUrl = (url: string) => {
  return url.includes('/transfer?address=');
};

export const parsePayUrl = (url: string) => {
  if (isPayUrl(url)) {
    const [path, query] = url.split('?');
    const [pathNetwork, functionName] = path.split('/');
    const pathSegments = pathNetwork.split(':');
    const networkName = pathSegments[0];
    const tokenAddress = pathSegments.slice(1).join(':');
    const params = qs.parse(query || '') as {
      address: string;
    };
    const address = params.address;

    if (address && networkName && tokenAddress && functionName) {
      return {
        address,
        networkName,
        tokenAddress,
        functionName,
      };
    }
  }
  return undefined;
};
