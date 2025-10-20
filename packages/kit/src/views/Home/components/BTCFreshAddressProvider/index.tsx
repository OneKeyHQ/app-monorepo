import { useEffect } from 'react';

import { Button, Dialog, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

export function BTCFreshAddressProvider() {
  const {
    activeAccount: { network, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const previousIndexedAccountId = usePrevious(indexedAccount?.id);

  useEffect(() => {
    if (!indexedAccount?.id) {
      return;
    }
    if (network?.id) {
      void backgroundApiProxy.serviceAccountProfile.syncBTCFreshAddressByIndexedAccountId(
        {
          indexedAccountId: indexedAccount.id,
          networkId: network.id,
        },
      );
    }
  }, [indexedAccount?.id, previousIndexedAccountId, network?.id]);

  useEffect(() => {
    const fn = () => {
      Dialog.show({
        icon: 'SwitchHorOutline',
        title: 'Single address required',
        description:
          'Connection requires single address mode. Please disable Multiple addresses before proceeding.',
        renderContent: (
          <YStack mt="$-1.5">
            <Button
              icon="QuestionmarkOutline"
              size="small"
              variant="tertiary"
              alignSelf="flex-start"
            >
              Learn more
            </Button>
          </YStack>
        ),
        onConfirmText: 'Switch now',
        onConfirm: () => {
          console.log('switch');
        },
      });
    };
    appEventBus.on(EAppEventBusNames.BtcFreshAddressConnectDappRejected, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.BtcFreshAddressConnectDappRejected, fn);
    };
  }, []);

  return null;
}
