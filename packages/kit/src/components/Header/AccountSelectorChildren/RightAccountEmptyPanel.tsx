import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Center, Icon, PresenceTransition, Text } from '@onekeyhq/components';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';

import { useNetwork } from '../../../hooks/useNetwork';
import {
  NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
  useCreateAccountInWallet,
} from '../../NetworkAccountSelector/hooks/useCreateAccountInWallet';

export type IRightAccountEmptyPanelProps = {
  activeWallet: Wallet | null | undefined;
  selectedNetworkId: string | undefined;
};

function RightAccountEmptyPanel({
  activeWallet,
  selectedNetworkId,
}: IRightAccountEmptyPanelProps) {
  const intl = useIntl();
  const activeWalletId = activeWallet?.id;
  const { isCreateAccountSupported } = useCreateAccountInWallet({
    networkId: selectedNetworkId,
    walletId: activeWalletId,
  });

  const isSupported = useMemo(
    () => isCreateAccountSupported,
    [isCreateAccountSupported],
  );

  const { network } = useNetwork({ networkId: selectedNetworkId });

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

    if (!isSupported) {
      title = '🌍';
      desc = intl.formatMessage(
        {
          id: NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
        },
        { 0: network?.shortName },
      );
    }
    if (title || desc) {
      return { title, desc };
    }
    return undefined;
  }, [activeWallet?.type, isSupported, intl, network]);

  // if (selectedNetworkId === AllNetwork) return null;

  const content = useMemo(
    () => (
      <PresenceTransition
        style={{ flex: 1 }}
        visible={!!emptyInfo}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: {
            duration: 150,
          },
        }}
      >
        <Center flex={1} px={4} py={4}>
          <Text fontSize={48} textAlign="center">
            {emptyInfo?.title}
          </Text>
          <Text my={6} typography="DisplaySmall" textAlign="center">
            {emptyInfo?.desc}
          </Text>
          {isSupported ? (
            <Icon
              name="ArrowBottomLeftIllus"
              size={62}
              color="interactive-default"
            />
          ) : null}
        </Center>
      </PresenceTransition>
    ),
    [emptyInfo, isSupported],
  );

  if (!activeWallet || !activeWallet?.type) {
    return null;
  }

  return content;
}

export default memo(RightAccountEmptyPanel);
