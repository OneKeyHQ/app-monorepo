import React, { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Center, Icon, Text } from '@onekeyhq/components';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
  Wallet,
} from '@onekeyhq/engine/src/types/wallet';

import {
  NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
  useCreateAccountInWallet,
} from './RightAccountCreateButton';
import { AccountGroup } from './RightAccountSection/ItemSection';

export type IRightAccountEmptyPanelProps = {
  activeAccounts: AccountGroup[];
  activeWallet: Wallet | null;
  selectedNetworkId: string;
};
export function RightAccountEmptyPanel({
  activeWallet,
  selectedNetworkId,
}: IRightAccountEmptyPanelProps) {
  const intl = useIntl();
  const { isCreateAccountSupported } = useCreateAccountInWallet({
    networkId: selectedNetworkId,
    walletId: activeWallet?.id,
  });

  const emptyInfo = useMemo(() => {
    let title = '';
    let desc = '';
    if (activeWallet?.type === WALLET_TYPE_IMPORTED) {
      title = '📥';
      desc = intl.formatMessage({
        id: 'content__import_private_key_as_imported_account',
      });
    }
    if (activeWallet?.type === WALLET_TYPE_WATCHING) {
      title = '👀';
      desc = intl.formatMessage({
        id: 'content__import_address_as_watched_account',
      });
    }
    if (activeWallet?.type === WALLET_TYPE_EXTERNAL) {
      title = '🔗';
      desc = intl.formatMessage({
        id: 'content__connect_wallet_as_external_account',
      });
    }

    if (!isCreateAccountSupported) {
      title = '🌍';
      desc = intl.formatMessage({
        id: NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
      });
    }
    if (title || desc) {
      return { title, desc };
    }
    return undefined;
  }, [activeWallet?.type, isCreateAccountSupported, intl]);

  // if (selectedNetworkId === AllNetwork) return null;
  if (!emptyInfo) return null;

  return (
    <Center flex={1} px={4} py={8}>
      <Text fontSize={48} lineHeight={48} textAlign="center">
        {emptyInfo.title}
      </Text>
      <Text my={6} typography="DisplaySmall" textAlign="center">
        {emptyInfo.desc}
      </Text>
      {isCreateAccountSupported ? (
        <Icon
          name="ArrowBottomLeftIllus"
          size={62}
          color="interactive-default"
        />
      ) : null}
    </Center>
  );
}
