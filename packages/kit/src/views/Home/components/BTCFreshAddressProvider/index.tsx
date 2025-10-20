import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function BTCFreshAddressProvider() {
  const intl = useIntl();
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
        title: intl.formatMessage({
          id: ETranslations.wallet_banner_single_address_required_title,
        }),
        description: intl.formatMessage({
          id: ETranslations.wallet_banner_single_address_required_description,
        }),
        renderContent: (
          <YStack mt="$-1.5">
            <Button
              icon="QuestionmarkOutline"
              size="small"
              variant="tertiary"
              alignSelf="flex-start"
            >
              {intl.formatMessage({
                id: ETranslations.global_learn_more,
              })}
            </Button>
          </YStack>
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_button_switch_now,
        }),
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
