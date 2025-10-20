import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Button, Dialog, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { FRESH_ADDRESS_LEARN_MORE_URL } from '@onekeyhq/shared/src/config/appConfig';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function BTCFreshAddressProvider() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    activeAccount: { network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const dialogRef = useRef<IDialogInstance | null>(null);

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
      if (dialogRef.current) {
        return;
      }
      const resetRef = () => {
        dialogRef.current = null;
      };
      dialogRef.current = Dialog.show({
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
              onPress={() => {
                openUrlExternal(FRESH_ADDRESS_LEARN_MORE_URL);
              }}
            >
              {intl.formatMessage({
                id: ETranslations.global_learn_more,
              })}
            </Button>
          </YStack>
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_button_switch,
        }),
        onConfirm: () => {
          resetRef();
          navigation.pushModal(EModalRoutes.SettingModal, {
            screen: EModalSettingRoutes.SettingListModal,
          });
        },
        onCancel: resetRef,
        onClose: resetRef,
      });
    };
    appEventBus.on(EAppEventBusNames.BtcFreshAddressConnectDappRejected, fn);
    return () => {
      void dialogRef.current?.close?.();
      dialogRef.current = null;
      appEventBus.off(EAppEventBusNames.BtcFreshAddressConnectDappRejected, fn);
    };
  }, [intl, navigation]);

  return null;
}
