import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  HeaderIconButton,
  Icon,
  Page,
  Popover,
  SegmentControl,
  Select,
  SizableText,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { useCurrencySections } from '@onekeyhq/kit/src/hooks/useCurrencySections';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import {
  useAccountSelectorContextData,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { useLanguageSelector } from '../../views/Setting/hooks';
import { AccountSelectorProviderMirror } from '../AccountSelector';
import { ListItem } from '../ListItem';

import {
  DownloadButton,
  HeaderNotificationIconButton,
  LanguageButton,
  ThemeButton,
  WalletConnectionForWeb,
  WebHeaderNavigation,
} from './components';
import { HeaderTitle } from './HeaderTitle';
import { UniversalSearchInput } from './UniversalSearchInput';

import type { ITabPageHeaderProp } from './type';

function LanguageListItem() {
  const intl = useIntl();
  const { options, value, onChange } = useLanguageSelector();
  const label = useMemo(() => {
    return options.find((i) => i.value === value)?.label;
  }, [options, value]);
  const title = useMemo(() => {
    return intl.formatMessage({ id: ETranslations.global_language });
  }, [intl]);
  return (
    <Select
      title={title}
      items={options}
      value={value}
      onChange={onChange}
      floatingPanelProps={{ maxHeight: 280 }}
      placement="bottom-end"
      renderTrigger={() => (
        <ListItem
          title={title}
          drillIn
          titleProps={{
            size: '$bodyMdMedium',
          }}
        >
          <SizableText size="$bodyMd" color="textSubdued" userSelect="none">
            {label}
          </SizableText>
        </ListItem>
      )}
    />
  );
}

function CurrencyListItem() {
  const [settings] = useSettingsPersistAtom();
  const sections = useCurrencySections();
  const formatSections = useMemo(() => {
    return sections.map((i) => {
      return {
        title: i.title,
        data: i.data.map((item) => {
          return {
            value: item.id,
            label: `${item.id.toUpperCase()} - ${item.unit}`,
          };
        }),
      };
    });
  }, [sections]);
  const intl = useIntl();
  const title = useMemo(() => {
    return intl.formatMessage({ id: ETranslations.settings_default_currency });
  }, [intl]);
  const handleChange = useCallback(
    async (currencyId: string) => {
      if (currencyId) {
        for (let i = 0; i < sections.length; i += 1) {
          const item = sections[i].data.find((idx) => idx.id === currencyId);
          if (item) {
            await backgroundApiProxy.serviceSetting.setCurrency({
              id: item.id,
              symbol: item.unit,
            });
            setTimeout(() => {
              void backgroundApiProxy.serviceApp.restartApp();
            });
            return;
          }
        }
      }
    },
    [sections],
  );
  return (
    <Select
      title={title}
      sections={formatSections}
      value={settings.currencyInfo.id}
      onChange={handleChange}
      floatingPanelProps={{ maxHeight: 280 }}
      placement="bottom-end"
      renderTrigger={() => (
        <ListItem
          title={title}
          drillIn
          titleProps={{
            size: '$bodyMdMedium',
          }}
        >
          <SizableText size="$bodyMd" color="textSubdued" userSelect="none">
            {settings.currencyInfo.id.toUpperCase()}
          </SizableText>
        </ListItem>
      )}
    />
  );
}

function ThemeListItem() {
  const intl = useIntl();
  const [{ theme }] = useSettingsPersistAtom();
  const tabOptions = useMemo(
    () => [
      {
        label: <Icon name="LaptopOutline" size="$4" />,
        value: 'system' as const,
      },
      {
        label: <Icon name="SunOutline" size="$4" />,
        value: 'light' as const,
      },
      {
        label: <Icon name="MoonOutline" size="$4" />,
        value: 'dark' as const,
      },
    ],
    [],
  );
  const handleChange = useCallback(async (value: unknown) => {
    await backgroundApiProxy.serviceSetting.setTheme(
      value as 'light' | 'dark' | 'system',
    );
  }, []);
  return (
    <ListItem
      title={intl.formatMessage({ id: ETranslations.settings_theme })}
      titleProps={{
        size: '$bodyMdMedium',
      }}
    >
      <SegmentControl
        options={tabOptions}
        value={theme}
        onChange={handleChange}
      />
    </ListItem>
  );
}

function DownloadOneKeyWalletListItem() {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    openUrlExternal(DOWNLOAD_URL);
  }, []);
  return (
    <ListItem
      title={intl.formatMessage({
        id: ETranslations.global_download_onekey_wallet,
      })}
      titleProps={{
        size: '$bodyMdMedium',
      }}
      drillIn
      onPress={handlePress}
    />
  );
}

function Web3GuideListItem() {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    // TODO: implement Web3 guide link
  }, []);
  return (
    <ListItem
      title={intl.formatMessage({ id: ETranslations.global_web3_guide })}
      titleProps={{
        size: '$bodyMdMedium',
      }}
      drillIn
      onPress={handlePress}
    />
  );
}

function AnnouncementListItem() {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    openUrlExternal('https://help.onekey.so/collections/13034490');
  }, []);
  return (
    <ListItem
      title={intl.formatMessage({ id: ETranslations.global_announcement })}
      drillIn
      titleProps={{
        size: '$bodyMdMedium',
      }}
      onPress={handlePress}
    />
  );
}

function MoreDappAction({ size }: { size?: 'small' | 'medium' }) {
  const intl = useIntl();

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.address_book_menu_title })}
      showHeader={false}
      keepChildrenMounted
      floatingPanelProps={{
        maxWidth: 288,
        width: 288,
        p: 0,
        overflow: 'hidden',
        style: { transformOrigin: 'bottom left' },
      }}
      placement="bottom-end"
      renderTrigger={
        <HeaderIconButton
          testID="moreActions"
          title={intl.formatMessage({
            id: ETranslations.address_book_menu_title,
          })}
          icon="DotGridOutline"
          size={size}
        />
      }
      renderContent={
        <YStack py="$3">
          <ThemeListItem />
          <LanguageListItem />
          <CurrencyListItem />
          <DownloadOneKeyWalletListItem />
          {/* <Web3GuideListItem /> */}
          <YStack py="$1.5" px="$3">
            <Divider />
          </YStack>
          <AnnouncementListItem />
        </YStack>
      }
    />
  );
}

function DepositButton() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet, account, network, indexedAccount },
  } = useActiveAccount({
    num: 0,
  });

  const shouldShow = useMemo(() => {
    return !!account && !!wallet;
  }, [account, wallet]);

  const handlePress = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
        walletId: wallet?.id ?? '',
        indexedAccountId: indexedAccount?.id,
      },
    });
  }, [navigation, network?.id, account?.id, wallet?.id, indexedAccount?.id]);

  if (!shouldShow) {
    return null;
  }

  return (
    <Button size="small" variant="primary" onPress={handlePress}>
      {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
    </Button>
  );
}

function RightActions({ tabRoute }: { tabRoute: ETabRoutes }) {
  const {
    activeAccount: { wallet, account },
  } = useActiveAccount({
    num: 0,
  });

  const isWalletConnected = !!wallet && !!account;

  return (
    <XStack ai="center" gap="$2">
      <XStack
        ai="center"
        px={isWalletConnected ? '$1.5' : undefined}
        borderRadius="$2"
        bg={isWalletConnected ? '$bgStrong' : undefined}
      >
        <WalletConnectionForWeb tabRoute={tabRoute} />
      </XStack>
      <DepositButton />
      <XStack
        ai="center"
        gap="$2.5"
        px="$1.5"
        py="$1.5"
        borderRadius="$2"
        bg="$bgStrong"
      >
        <HeaderNotificationIconButton
          testID="header-right-notification"
          size="small"
        />
        <MoreDappAction size="small" />
        <DownloadButton size="small" />
        <LanguageButton size="small" />
        <ThemeButton size="small" />
      </XStack>
    </XStack>
  );
}

export function DappHeader({ sceneName, tabRoute }: ITabPageHeaderProp) {
  const theme = useTheme();
  const renderHeaderLeft = useCallback(() => <WebHeaderNavigation />, []);
  const { config } = useAccountSelectorContextData();

  const renderHeaderRight = useCallback(
    () =>
      config ? (
        <HomeTokenListProviderMirror>
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <RightActions tabRoute={tabRoute} />
          </AccountSelectorProviderMirror>
        </HomeTokenListProviderMirror>
      ) : null,
    [config, tabRoute],
  );

  const renderHeaderTitle = useCallback(
    () => (
      <HeaderTitle sceneName={sceneName}>
        <XStack maxWidth={288} width="100%">
          <UniversalSearchInput />
        </XStack>
      </HeaderTitle>
    ),
    [sceneName],
  );
  return (
    <Page.Header
      headerTitleAlign="center"
      headerShadowVisible={false}
      headerStyle={{
        backgroundColor: 'transparent',
      }}
      headerTitle={renderHeaderTitle}
      headerRight={renderHeaderRight}
      headerLeft={renderHeaderLeft}
    />
  );
}
