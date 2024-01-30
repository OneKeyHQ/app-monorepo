import type { IServerNetwork } from '@onekeyhq/shared/types';

export const groupNetworks = (networks: IServerNetwork[]) => {
  const data = networks.reduce((result, item) => {
    const firstLetter = item.name[0].toUpperCase();
    if (!result[firstLetter]) {
      result[firstLetter] = [];
    }
    result[firstLetter].push(item);

    return result;
  }, {} as Record<string, IServerNetwork[]>);
  return Object.entries(data)
    .map(([key, items]) => ({ title: key, data: items }))
    .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));
};

export const filterNetworks = (
  networks: IServerNetwork[],
  searchKey: string,
) => {
  const key = searchKey.trim().toLowerCase();
  if (key) {
    return networks.filter(
      (o) =>
        o.name.toLowerCase().includes(key) ||
        o.shortname.toLowerCase().includes(key),
    );
  }
  return networks;
};
