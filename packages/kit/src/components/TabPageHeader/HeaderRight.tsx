import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, useMedia } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import type { IOpenUrlRouteInfo } from '@onekeyhq/shared/src/utils/extUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';

import { UniversalSearchInput } from './UniversalSearchInput';

export function HeaderRight({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const scanQrCode = useScanQrCode();
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const openSettingPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  const onScanButtonPressed = useCallback(
    () =>
      scanQrCode.start({
        handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
        autoHandleResult: true,
        account,
        tokens: {
          data: allTokens.tokens,
          keys: allTokens.keys,
          map,
        },
      }),
    [scanQrCode, account, allTokens, map],
  );

  const openExtensionExpandTab = useCallback(async () => {
    // This is a trick.
    // If you open the webpage first and then close the side panel, you will never be able to close the side panel.
    window.close();
    await backgroundApiProxy.serviceApp.openExtensionExpandTab({
      routes: '',
    });
  }, []);

  const expandExtView = useMemo(
    () => (
      <HeaderIconButton
        key="expandExtView"
        title={intl.formatMessage({ id: ETranslations.global_expand_view })}
        icon="ExpandOutline"
        onPress={openExtensionExpandTab}
      />
    ),
    [intl, openExtensionExpandTab],
  );

  const openLayoutTab = useCallback(async () => {
    ActionList.show({
      title: intl.formatMessage({
        id: ETranslations.global_layout,
      }),
      items: [
        {
          label: intl.formatMessage({
            id: ETranslations.open_as_sidebar,
          }),
          icon: 'LayoutRightOutline',
          onPress: async () => {
            await backgroundApiProxy.serviceApp.openExtensionSidePanel({
              routes: '',
            });
            window.close();
          },
        },
        {
          label: intl.formatMessage({
            id: ETranslations.global_expand_view,
          }),
          icon: 'ExpandOutline',
          onPress: openExtensionExpandTab,
        },
      ],
    });
  }, [intl, openExtensionExpandTab]);

  const media = useMedia();
  const items = useMemo(() => {
    const settingsButton = (
      <HeaderIconButton
        key="setting"
        title={intl.formatMessage({ id: ETranslations.settings_settings })}
        icon="SettingsOutline"
        testID="setting"
        onPress={openSettingPage}
      />
    );

    const layoutExtView = (
      <HeaderIconButton
        key="layoutRightView"
        title={intl.formatMessage({ id: ETranslations.global_layout })}
        icon="LayoutRightOutline"
        onPress={openLayoutTab}
      />
    );
    const scanButton = (
      <HeaderIconButton
        key="scan"
        title={intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
        icon="ScanOutline"
        onPress={onScanButtonPressed}
      />
    );
    const searchInput = media.gtMd ? (
      <UniversalSearchInput key="searchInput" />
    ) : null;

    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return [
        platformEnv.isNative ? null : (
          <UrlAccountNavHeader.OpenInApp key="urlAccountOpenInApp" />
        ),
        <UrlAccountNavHeader.Share key="urlAccountShare" />,
      ].filter(Boolean);
    }

    if (platformEnv.isExtensionUiPopup) {
      return [layoutExtView, settingsButton];
    }

    if (platformEnv.isExtensionUiSidePanel) {
      return [expandExtView, settingsButton];
    }

    return [scanButton, settingsButton, searchInput];
  }, [
    expandExtView,
    intl,
    media.gtMd,
    onScanButtonPressed,
    openLayoutTab,
    openSettingPage,
    sceneName,
  ]);
  return (
    <HeaderButtonGroup
      testID="Wallet-Page-Header-Right"
      className="app-region-no-drag"
    >
      {items}
    </HeaderButtonGroup>
  );
}
