import type {
  BOT_WALLET_STATUS_ACTIVE,
  BOT_WALLET_STATUS_DEACTIVATED,
} from '../src/consts/dbConsts';

export type IBotWalletStatus =
  | typeof BOT_WALLET_STATUS_ACTIVE
  | typeof BOT_WALLET_STATUS_DEACTIVATED;

export type IBotWalletMetadata = {
  index: number;
  name: string;
  visible: boolean;
  status: IBotWalletStatus;
  deactivatedAt?: number;
  createdAt: number;
};

export type IBotWalletParsedId = {
  parentId: string;
  index: number;
};

export type IBotWalletMetadataMap = Record<string, IBotWalletMetadata>;
