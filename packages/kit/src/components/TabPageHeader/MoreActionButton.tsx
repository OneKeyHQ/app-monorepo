import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, HeaderIconButton } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalDeviceManagementRoutes,
  EModalRoutes,
  EModalSettingRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';
import { useOnLock } from '../../views/Setting/pages/List/DefaultSection';

export function MoreActionButton() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const onLock = useOnLock();
  const scanQrCode = useScanQrCode();
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const openAddressBook = useShowAddressBook({
    useNewModal: true,
  });

  const handleScan = useCallback(
    async (close: () => void) => {
      close();
      await scanQrCode.start({
        handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
        autoHandleResult: true,
        account,
        tokens: {
          data: allTokens.tokens,
          keys: allTokens.keys,
          map,
        },
      });
    },
    [scanQrCode, account, allTokens, map],
  );

  const handleSettings = useCallback(
    (close: () => void) => {
      close();
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListModal,
      });
    },
    [navigation],
  );

  const handleDeviceManagement = useCallback(
    async (close: () => void) => {
      close();
      try {
        const allHwQrWallet =
          await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice();
        if (Object.keys(allHwQrWallet).length > 0) {
          navigation.pushModal(EModalRoutes.DeviceManagementModal, {
            screen: EModalDeviceManagementRoutes.DeviceListModal,
          });
          return;
        }

        navigation.pushModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.DeviceManagementGuide,
        });
      } catch (error) {
        console.error('Failed to handle device management:', error);
      }
    },
    [navigation],
  );

  const handleAddressBook = useCallback(
    (close: () => void) => {
      close();
      void openAddressBook();
    },
    [openAddressBook],
  );

  return (
    <ActionList
      key="more-action"
      title={intl.formatMessage({ id: ETranslations.explore_options })}
      renderTrigger={
        <HeaderIconButton
          title={intl.formatMessage({ id: ETranslations.explore_options })}
          icon="DotGridOutline"
        />
      }
      sections={[
        {
          items: [
            {
              label: intl.formatMessage({
                id: ETranslations.settings_lock_now,
              }),
              icon: 'LockOutline',
              onPress: onLock,
              testID: 'lock-now',
            },
            {
              label: intl.formatMessage({
                id: ETranslations.scan_scan_qr_code,
              }),
              icon: 'ScanOutline',
              onPress: handleScan,
              testID: 'scan-qr-code',
            },
          ],
        },
        {
          items: [
            {
              label: intl.formatMessage({ id: ETranslations.global_my_onekey }),
              icon: 'OnekeyDeviceCustom',
              onPress: handleDeviceManagement,
              testID: 'my-onekey',
            },
            {
              label: intl.formatMessage({
                id: ETranslations.address_book_title,
              }),
              icon: 'ContactsOutline',
              onPress: handleAddressBook,
              testID: 'address-book',
            },
          ],
        },
        {
          items: [
            {
              label: intl.formatMessage({
                id: ETranslations.settings_settings,
              }),
              icon: 'SettingsOutline',
              onPress: handleSettings,
            },
          ],
        },
      ]}
    />
  );
}
