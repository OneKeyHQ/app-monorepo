// safe import
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';

import type { HasName } from './base';

const WALLET_TYPE_HD = 'hd';
const WALLET_TYPE_HW = 'hw';
const WALLET_TYPE_IMPORTED = 'imported'; // as walletId
const WALLET_TYPE_WATCHING = 'watching'; // as walletId
const WALLET_TYPE_EXTERNAL = 'external'; // as walletId

type WalletType =
  | typeof WALLET_TYPE_HD
  | typeof WALLET_TYPE_HW
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;

type Wallet = HasName & {
  type: WalletType;
  backuped: boolean;
  accounts: Array<string>;
  nextAccountIds: Record<string, number>; // purpose + cointype => index
  associatedDevice?: string; // alias to `deviceId`
  avatar?: Avatar;
  deviceType?: string;
  hidden?: boolean;
  passphraseState?: string;
};

type ISetNextAccountIdsParams = {
  walletId: string;
  nextAccountIds: Record<string, number>;
};

export {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
  WALLET_TYPE_EXTERNAL,
};
export type { WalletType, Wallet, ISetNextAccountIdsParams };
