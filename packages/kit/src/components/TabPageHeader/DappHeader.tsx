import { type ReactNode, useCallback, useMemo, useState } from 'react';

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
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import { useCurrencySections } from '@onekeyhq/kit/src/hooks/useCurrencySections';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  DOWNLOAD_MOBILE_APP_URL,
  DOWNLOAD_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalSettingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
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
  HeaderNotificationIconButton,
  LanguageButton,
  ThemeButton,
  WalletConnectionForWeb,
  WalletConnectionGroup,
  WebHeaderNavigation,
} from './components';
import { HeaderTitle } from './HeaderTitle';
import { UniversalSearchInput } from './UniversalSearchInput';

import type { ITabPageHeaderProp } from './type';

function LanguageListItem({
  open,
  onOpenChange: onOpenChangeProp,
}: {
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
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
      open={open}
      onChange={onChange}
      onOpenChange={onOpenChangeProp}
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{
        disableDrag: true,
        snapPoints: [80],
        snapPointsMode: 'percent',
      }}
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

function CurrencyListItem({
  open,
  onOpenChange: onOpenChangeProp,
}: {
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
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
      open={open}
      onChange={handleChange}
      onOpenChange={onOpenChangeProp}
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{
        disableDrag: true,
        snapPoints: [80],
        snapPointsMode: 'percent',
      }}
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
        label: (
          <Icon
            my="$0.5"
            name="LaptopOutline"
            size="$4"
            color={theme === 'system' ? '$iconInverse' : '$icon'}
          />
        ),
        value: 'system' as const,
      },
      {
        label: (
          <Icon
            my="$0.5"
            name="SunOutline"
            size="$4"
            color={theme === 'light' ? '$iconInverse' : '$icon'}
          />
        ),
        value: 'light' as const,
      },
      {
        label: (
          <Icon
            my="$0.5"
            name="MoonOutline"
            size="$4"
            color={theme === 'dark' ? '$iconInverse' : '$icon'}
          />
        ),
        value: 'dark' as const,
      },
    ],
    [theme],
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

function DownloadAppButton() {
  const handlePress = useCallback(() => {
    openUrlExternal(DOWNLOAD_MOBILE_APP_URL);
  }, []);

  return (
    <Button
      size="small"
      h="$8"
      icon="DownloadOutline"
      bg="#49DF58"
      color="#000000"
      iconColor="#000000"
      hoverStyle={{ bg: '#3ECC4D' }}
      pressStyle={{ bg: '#35B844' }}
      onPress={handlePress}
    >
      APP
    </Button>
  );
}

function SearchButton() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const handlePress = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
    });
  }, [navigation]);

  return (
    <XStack ai="center" px="$1.5" py="$1.5" borderRadius="$2" bg="$bgStrong">
      <HeaderIconButton
        size="small"
        icon="SearchOutline"
        title={intl.formatMessage({
          id: ETranslations.global_search_everything,
        })}
        onPress={handlePress}
      />
    </XStack>
  );
}

// function Web3GuideListItem() {
//   const intl = useIntl();
//   const handlePress = useCallback(() => {
//     // TODO: implement Web3 guide link
//   }, []);
//   return (
//     <ListItem
//       title={intl.formatMessage({ id: ETranslations.global_web3_guide })}
//       titleProps={{
//         size: '$bodyMdMedium',
//       }}
//       drillIn
//       onPress={handlePress}
//     />
//   );
// }

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

function SettingListItem({
  onBeforeNavigate,
}: {
  onBeforeNavigate?: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { closePopover } = usePopoverContext();
  const handlePress = useCallback(async () => {
    onBeforeNavigate?.();
    await closePopover?.();
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [closePopover, navigation, onBeforeNavigate]);
  return (
    <ListItem
      title={intl.formatMessage({ id: ETranslations.settings_settings })}
      drillIn
      titleProps={{
        size: '$bodyMdMedium',
      }}
      onPress={handlePress}
    />
  );
}

function MoreDappActionContent() {
  const [activeSelect, setActiveSelect] = useState<
    'language' | 'currency' | null
  >(null);

  const handleLanguageOpenChange = useCallback((isOpen: boolean) => {
    setActiveSelect(isOpen ? 'language' : null);
  }, []);

  const handleCurrencyOpenChange = useCallback((isOpen: boolean) => {
    setActiveSelect(isOpen ? 'currency' : null);
  }, []);

  const closeAllDropdowns = useCallback(() => {
    setActiveSelect(null);
  }, []);

  return (
    <YStack py="$3">
      <ThemeListItem />
      <LanguageListItem
        open={activeSelect === 'language'}
        onOpenChange={handleLanguageOpenChange}
      />
      <CurrencyListItem
        open={activeSelect === 'currency'}
        onOpenChange={handleCurrencyOpenChange}
      />
      <DownloadOneKeyWalletListItem />
      {/* <Web3GuideListItem /> */}
      <YStack py="$1.5" px="$3">
        <Divider />
      </YStack>
      <AnnouncementListItem />
      <SettingListItem onBeforeNavigate={closeAllDropdowns} />
    </YStack>
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
      renderContent={<MoreDappActionContent />}
    />
  );
}

function RightActions({
  tabRoute,
  customHeaderRightItems,
  customToolbarItems,
}: {
  tabRoute: ETabRoutes;
  customHeaderRightItems?: ReactNode;
  customToolbarItems?: ReactNode;
}) {
  const { gtLg } = useMedia();
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet, account },
  } = useActiveAccount({
    num: 0,
  });

  const isWalletConnected = !!wallet && !!account;
  const isPerpsTab = tabRoute === ETabRoutes.Perp;

  const handleSearchPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
    });
  }, [navigation]);

  const intl = useIntl();

  return (
    <XStack ai="center" gap="$2">
      {gtLg ? (
        <SearchButton />
      ) : (
        <HeaderIconButton
          size="small"
          icon="SearchOutline"
          title={intl.formatMessage({
            id: ETranslations.global_search_everything,
          })}
          onPress={handleSearchPress}
        />
      )}
      {isPerpsTab && customHeaderRightItems ? (
        customHeaderRightItems
      ) : (
        <>
          <XStack
            ai="center"
            px={isWalletConnected ? '$1.5' : undefined}
            borderRadius="$2"
            bg={isWalletConnected ? '$bgStrong' : undefined}
          >
            <WalletConnectionForWeb tabRoute={tabRoute} />
          </XStack>
        </>
      )}
      {!isPerpsTab && gtLg ? <DownloadAppButton /> : null}
      <XStack
        ai="center"
        gap="$2.5"
        px="$1.5"
        py="$1.5"
        borderRadius="$2"
        bg="$bgStrong"
      >
        {customToolbarItems}
        <HeaderNotificationIconButton
          testID="header-right-notification"
          size="small"
        />
        <MoreDappAction size="small" />
        <LanguageButton size="small" />
        <ThemeButton size="small" />
      </XStack>
    </XStack>
  );
}

function MobileRightActions() {
  return (
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
        size="medium"
      />
      <MoreDappAction size="medium" />
    </XStack>
  );
}

function MobileLeftActions({ tabRoute }: { tabRoute: ETabRoutes }) {
  return (
    <XStack ai="center">
      <WalletConnectionGroup
        tabRoute={tabRoute}
        showNetworkSelector={false}
        showAccountInfo={false}
      />
    </XStack>
  );
}

export function DappHeader({
  sceneName,
  tabRoute,
  hideSearch,
  customHeaderRightItems,
  customToolbarItems,
}: ITabPageHeaderProp) {
  const { gtMd } = useMedia();
  const { config } = useAccountSelectorContextData();

  // Desktop layout
  const renderDesktopHeaderLeft = useCallback(
    () => <WebHeaderNavigation />,
    [],
  );

  const renderDesktopHeaderRight = useCallback(
    () =>
      config ? (
        <HomeTokenListProviderMirror>
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <RightActions
              tabRoute={tabRoute}
              customHeaderRightItems={customHeaderRightItems}
              customToolbarItems={customToolbarItems}
            />
          </AccountSelectorProviderMirror>
        </HomeTokenListProviderMirror>
      ) : null,
    [config, customHeaderRightItems, customToolbarItems, tabRoute],
  );

  const renderDesktopHeaderTitle = useCallback(
    () => <HeaderTitle sceneName={sceneName} />,
    [sceneName],
  );

  // Mobile layout
  const renderMobileHeaderLeft = useCallback(
    () =>
      config ? (
        <HomeTokenListProviderMirror>
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <MobileLeftActions tabRoute={tabRoute} />
          </AccountSelectorProviderMirror>
        </HomeTokenListProviderMirror>
      ) : null,
    [config, tabRoute],
  );

  const renderMobileHeaderRight = useCallback(() => <MobileRightActions />, []);

  if (gtMd) {
    return (
      <>
        <Page.Header
          headerTitleAlign="center"
          headerShadowVisible={false}
          headerStyle={{
            backgroundColor: 'transparent',
          }}
          headerTitle={renderDesktopHeaderTitle}
          headerRight={renderDesktopHeaderRight}
          headerLeft={renderDesktopHeaderLeft}
        />
        <XStack h="$px" bg="$borderSubdued" />
      </>
    );
  }

  // Mobile layout
  return (
    <>
      <Page.Header
        headerShadowVisible={false}
        headerStyle={{
          backgroundColor: 'transparent',
        }}
        headerLeft={renderMobileHeaderLeft}
        headerRight={renderMobileHeaderRight}
      />
      {!hideSearch ? (
        <XStack px="$pagePadding" pt="$2" pb="$2">
          <UniversalSearchInput />
        </XStack>
      ) : null}
      <XStack h="$px" bg="$borderSubdued" />
    </>
  );
}
