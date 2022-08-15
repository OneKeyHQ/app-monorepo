import { Avatar } from '@onekeyhq/kit/src/utils/emojiUtils';

import { HasName } from './base';

const WALLET_TYPE_HD = 'hd';
const WALLET_TYPE_HW = 'hw';
const WALLET_TYPE_IMPORTED = 'imported';
const WALLET_TYPE_WATCHING = 'watching';
const WALLET_TYPE_EXTERNAL = 'external';

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
  associatedDevice?: string;
  avatar?: Avatar;
  deviceType?: string;
};

export {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
  WALLET_TYPE_EXTERNAL,
};
export type { WalletType, Wallet };
