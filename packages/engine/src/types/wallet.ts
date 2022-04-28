import { Avatar } from '@onekeyhq/kit/src/utils/emojiUtils';

import { HasName } from './base';

const WALLET_TYPE_HD = 'hd';
const WALLET_TYPE_HW = 'hw';
const WALLET_TYPE_IMPORTED = 'imported';
const WALLET_TYPE_WATCHING = 'watching';

type WalletType = 'hd' | 'hw' | 'imported' | 'watching';

type Wallet = HasName & {
  type: WalletType;
  backuped: boolean;
  accounts: Array<string>;
  nextAccountIds: Record<string, number>; // purpose + cointype => index
  associatedDevice?: string;
  avatar?: Avatar;
};

export {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
};
export type { WalletType, Wallet };
