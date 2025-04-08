import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, HeaderIconButton } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import {
  useIsShowMyOneKeyOnTabbar,
  useToMyOneKeyModal,
} from '@onekeyhq/kit/src/views/DeviceManagement/hooks/useToMyOneKeyModal';
import { HomeTokenListProviderMirror } from '@onekeyhq/kit/src/views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useLoginOneKeyId } from '../../hooks/useLoginOneKeyId';
import { useReferFriends } from '../../hooks/useReferFriends';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';
import { useOnLock } from '../../views/Setting/pages/List/DefaultSection';
import { AccountSelectorProviderMirror } from '../AccountSelector';

function MoreActionButtonCmp() {
  const [devSettings] = useDevSettingsPersistAtom();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const onLock = useOnLock();
  const scanQrCode = useScanQrCode();
  const {
    activeAccount: { account, network },
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
        network,
        tokens: {
          data: allTokens.tokens,
          keys: allTokens.keys,
          map,
        },
      });
    },
    [scanQrCode, account, allTokens, map, network],
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

  const toMyOneKeyModal = useToMyOneKeyModal();
  const isShowMyOneKeyOnTabbar = useIsShowMyOneKeyOnTabbar();
  const handleDeviceManagement = useCallback(
    async (close: () => void) => {
      close();
      void toMyOneKeyModal();
    },
    [toMyOneKeyModal],
  );

  const handleAddressBook = useCallback(
    (close: () => void) => {
      close();
      void openAddressBook();
    },
    [openAddressBook],
  );

  const { toReferFriendsPage } = useReferFriends();
  const { loginOneKeyId } = useLoginOneKeyId();
  const popupMenu = useMemo(() => {
    if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
      const routeInfo = {
        routes: '',
      };
      return [
        platformEnv.isExtensionUiPopup
          ? {
              label: intl.formatMessage({
                id: ETranslations.open_as_sidebar,
              }),
              icon: 'LayoutRightOutline' as const,
              onPress: async () => {
                defaultLogger.account.wallet.openSidePanel();
                await extUtils.openPanelOnActionClick(true);
                await extUtils.openSidePanel(routeInfo);
                window.close();
              },
            }
          : {
              label: intl.formatMessage({
                id: ETranslations.open_as_popup,
              }),
              icon: 'LayoutTopOutline' as const,
              onPress: async () => {
                await extUtils.openPanelOnActionClick(false);
                window.close();
              },
            },
        {
          label: intl.formatMessage({
            id: ETranslations.global_expand_view,
          }),
          icon: 'ExpandOutline' as const,
          onPress: async () => {
            defaultLogger.account.wallet.openExpandView();
            window.close();
            await backgroundApiProxy.serviceApp.openExtensionExpandTab(
              routeInfo,
            );
          },
        },
      ];
    }
    return [];
  }, [intl]);

  return (
    <ActionList
      key="more-action"
      title={intl.formatMessage({ id: ETranslations.explore_options })}
      renderTrigger={
        <HeaderIconButton
          tooltipProps={{
            placement: 'bottom',
          }}
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
              icon: 'LockOutline' as const,
              onPress: onLock,
              testID: 'lock-now',
            },
            {
              label: intl.formatMessage({
                id: ETranslations.scan_scan_qr_code,
              }),
              icon: 'ScanOutline' as const,
              onPress: handleScan,
              testID: 'scan-qr-code',
            },
            ...popupMenu,
          ].filter(Boolean),
        },
        {
          items: !isShowMyOneKeyOnTabbar
            ? [
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_my_onekey,
                  }),
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
              ]
            : [
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

export function MoreActionButton() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <HomeTokenListProviderMirror>
        <MoreActionButtonCmp />
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
