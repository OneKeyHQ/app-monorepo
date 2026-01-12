import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  HeaderIconButton,
  Icon,
  Page,
  Popover,
  SegmentControl,
  Select,
  SizableText,
  Tooltip,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { useCurrencySections } from '@onekeyhq/kit/src/hooks/useCurrencySections';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
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
        <ListItem title={title} drillIn>
          <SizableText size="$bodyMd" color="textSubdued">
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
        <ListItem title={title} drillIn>
          <SizableText size="$bodyMd" color="textSubdued">
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
    <ListItem title={intl.formatMessage({ id: ETranslations.settings_theme })}>
      <SegmentControl
        options={tabOptions}
        value={theme}
        onChange={handleChange}
      />
    </ListItem>
  );
}

function DownloadOneKeyWalletListItem() {
  const handlePress = useCallback(() => {
    openUrlExternal(DOWNLOAD_URL);
  }, []);
  return (
    <ListItem title="Download OneKey wallet" drillIn onPress={handlePress} />
  );
}

function Web3GuideListItem() {
  const handlePress = useCallback(() => {
    // TODO: implement Web3 guide link
  }, []);
  return <ListItem title="Web3 guide" drillIn onPress={handlePress} />;
}

function AnnouncementListItem() {
  const handlePress = useCallback(() => {
    // TODO: implement Announcement link
  }, []);
  return <ListItem title="Announcement" drillIn onPress={handlePress} />;
}

function MoreDappAction() {
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
        <Tooltip
          placement="bottom"
          renderTrigger={
            <HeaderIconButton
              testID="moreActions"
              title={intl.formatMessage({ id: ETranslations.explore_options })}
              icon="DotGridOutline"
            />
          }
          renderContent={intl.formatMessage({
            id: ETranslations.address_book_menu_title,
          })}
        />
      }
      renderContent={
        <YStack py="$3">
          <ThemeListItem />
          <LanguageListItem />
          <CurrencyListItem />
          <DownloadOneKeyWalletListItem />
          <Web3GuideListItem />
          <Divider />
          <AnnouncementListItem />
        </YStack>
      }
    />
  );
}

function RightActions({ tabRoute }: { tabRoute: ETabRoutes }) {
  return (
    <XStack ai="center" gap="$2">
      <WalletConnectionForWeb tabRoute={tabRoute} />
      <XStack
        ai="center"
        gap="$2.5"
        px="$1.5"
        py="$1"
        borderRadius="$2"
        bg="$bgStrong"
      >
        <HeaderNotificationIconButton testID="header-right-notification" />
        <MoreDappAction />
        <DownloadButton />
        <LanguageButton />
        <ThemeButton />
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
    () => <HeaderTitle sceneName={sceneName} />,
    [sceneName],
  );
  return (
    <Page.Header
      headerTitleAlign="center"
      headerStyle={{ backgroundColor: theme.bgSubdued.val }}
      headerTitle={renderHeaderTitle}
      headerRight={renderHeaderRight}
      headerLeft={renderHeaderLeft}
    />
  );
}
