import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Icon,
  Image,
  InnerStroke,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useWebTabs } from '../../hooks/useWebTabs';

import { DashboardSectionHeader } from './DashboardSectionHeader';

import type { IWebTab } from '../../types';

const OPEN_BROWSER_TAB_LIMIT = 4;

function getTabTitle(tab: IWebTab) {
  return tab.customTitle || tab.title || tab.displayUrl || tab.url;
}

function getTabDomain(tab: IWebTab) {
  const url = tab.displayUrl || tab.url;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split(/[/?#]/)[0] || url;
  }
}

function isValidOpenBrowserTab(tab: IWebTab) {
  return tab.type !== 'home' && tab.url && tab.url !== 'about:blank';
}

function OpenBrowserTabItem({
  tab,
  onPress,
}: {
  tab: IWebTab;
  onPress: (tabId: string) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(tab.id);
  }, [onPress, tab.id]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      style={{ width: '100%' }}
    >
      <Stack
        width="100%"
        height="$14"
        p="$2"
        borderRadius="$3"
        bg="$bgSubdued"
        borderCurve="continuous"
        justifyContent="center"
        userSelect="none"
      >
        <XStack alignItems="center" gap="$2.5">
          <Stack
            width="$9"
            height="$9"
            position="relative"
            borderRadius="$2"
            borderCurve="continuous"
            overflow="hidden"
            flexShrink={0}
          >
            <Image
              width="100%"
              height="100%"
              source={{ uri: tab.favicon }}
              fallback={
                <Image.Fallback>
                  <Icon size="$7" color="$iconSubdued" name="GlobusOutline" />
                </Image.Fallback>
              }
            />
            <InnerStroke borderRadius="$2" />
          </Stack>
          <Stack flex={1} minWidth={0}>
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {getTabTitle(tab)}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {getTabDomain(tab)}
            </SizableText>
          </Stack>
        </XStack>
      </Stack>
    </TouchableOpacity>
  );
}

function OpenBrowserTabsSectionContent() {
  const intl = useIntl();
  const { tabs } = useWebTabs();
  const { setCurrentWebTab } = useBrowserTabActions().current;

  const openTabs = useMemo(
    () =>
      tabs
        .filter(isValidOpenBrowserTab)
        .toSorted((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, OPEN_BROWSER_TAB_LIMIT),
    [tabs],
  );

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <Stack px="$pagePadding" width="100%" mt="$3" minHeight="$28">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading selected>
          {intl.formatMessage({ id: ETranslations.global_current })}
        </DashboardSectionHeader.Heading>
      </DashboardSectionHeader>

      <XStack flexWrap="wrap" mx="$-1" py="$1">
        {openTabs.map((tab) => (
          <Stack key={tab.id} width="50%" p="$1">
            <OpenBrowserTabItem tab={tab} onPress={setCurrentWebTab} />
          </Stack>
        ))}
      </XStack>
    </Stack>
  );
}

export function OpenBrowserTabsSection() {
  if (!platformEnv.isNative) {
    return null;
  }

  return <OpenBrowserTabsSectionContent />;
}
