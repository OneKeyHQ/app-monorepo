export type DAppItemType = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  url: string;
  chain: string;
  status: string;
  favicon: string;
  pic?: string;
};

type BannerItemType = { dapp: string; pic: string };
type DAppTagsType = { name: string; dapps: string[] };

export type SyncRequestPayload = {
  timestamp: number;
  increment: Record<string, DAppItemType>;
  banners: BannerItemType[];
};

export type RankingsPayload = {
  tags: DAppTagsType[];
};
