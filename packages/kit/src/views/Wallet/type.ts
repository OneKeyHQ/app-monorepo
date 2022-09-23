import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { CollectiblesRoutesParams } from '../../routes/Modal/Collectibles';

export enum WalletHomeTabEnum {
  Tokens = 'Tokens',
  Collectibles = 'Collectibles',
  History = 'History',
}

export type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;
