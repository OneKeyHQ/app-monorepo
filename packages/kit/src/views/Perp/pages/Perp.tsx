import { useCallback, useMemo, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Image,
  Page,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { showHyperliquidTermsDialog } from '../components/HyperliquidTermsDialog';
import { PerpsGlobalEffects } from '../components/PerpsGlobalEffects';
import { PerpsHeaderRight } from '../components/TradingPanel/components/PerpsHeaderRight';
import { usePerpsLogo } from '../hooks/usePerpsLogo';
import { PerpDesktopLayout } from '../layouts/PerpDesktopLayout';
import { PerpMobileLayout } from '../layouts/PerpMobileLayout';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';

import type { LayoutChangeEvent } from 'react-native';

function PerpLayout() {
  const { gtMd } = useMedia();
  if (gtMd) {
    return <PerpDesktopLayout />;
  }
  return <PerpMobileLayout />;
}

function PerpNetworkStatus() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const isNetworkStable = networkStatus.connected;
  const networkStyle = useMemo(() => {
    return {
      badgeType: isNetworkStable ? 'success' : 'critical',
      indicatorBg: isNetworkStable ? '$success10' : '$critical10',
      text: isNetworkStable
        ? intl.formatMessage({ id: ETranslations.perp_online })
        : intl.formatMessage({ id: ETranslations.perp_offline }),
    };
  }, [isNetworkStable, intl]);
  return useMemo(
    () => (
      <Badge
        badgeType={networkStyle.badgeType}
        badgeSize="md"
        height={26}
        borderRadius="$full"
        pl="$2"
        px="$3"
        gap="$1.5"
        cursor="default"
      >
        <Stack
          position="relative"
          w={8}
          h={8}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          bg="$neutral3"
          p="$1.5"
        >
          <Stack
            position="absolute"
            w={6}
            h={6}
            borderRadius="$full"
            bg={networkStyle.indicatorBg}
          />
        </Stack>
        <Badge.Text style={{ fontSize: 12 }}>{networkStyle.text}</Badge.Text>
      </Badge>
    ),
    [networkStyle],
  );
}

function PerpContentFooter() {
  const { gtSm } = useMedia();
  const { poweredByHyperliquidLogo } = usePerpsLogo();
  return gtSm ? (
    <Page.Footer>
      <XStack
        borderTopWidth="$px"
        borderTopColor="$borderSubdued"
        bg="$bgApp"
        h={40}
        alignItems="center"
        p="$2"
        justifyContent="space-between"
      >
        <PerpNetworkStatus />
        <Image
          source={poweredByHyperliquidLogo}
          size={170}
          resizeMode="contain"
        />
      </XStack>
    </Page.Footer>
  ) : null;
}

console.log('PerpContent js loaded');

function PerpContent() {
  console.log('PerpContent render');
  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS ? 143 : 92,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const height = e.nativeEvent.layout.height - 20;
    setTabPageHeight(height);
  }, []);

  return (
    <Page>
      {platformEnv.isNative ? (
        <Stack h={tabPageHeight} />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.Perp}
          customHeaderRightItems={
            <PerpsAccountSelectorProviderMirror>
              <PerpsProviderMirror>
                <PerpsHeaderRight />
              </PerpsProviderMirror>
            </PerpsAccountSelectorProviderMirror>
          }
        />
      )}
      <Page.Body>
        <PerpLayout />
      </Page.Body>
      <PerpContentFooter />
      {platformEnv.isNative ? (
        <YStack
          position="absolute"
          top={-20}
          left={0}
          bg="$bgApp"
          pt="$5"
          width="100%"
          onLayout={handleTabPageLayout}
        >
          <TabPageHeader
            sceneName={EAccountSelectorSceneName.home}
            tabRoute={ETabRoutes.Perp}
            customHeaderRightItems={
              <PerpsAccountSelectorProviderMirror>
                <PerpsProviderMirror>
                  <PerpsHeaderRight />
                </PerpsProviderMirror>
              </PerpsAccountSelectorProviderMirror>
            }
          />
        </YStack>
      ) : null}
    </Page>
  );
}

export default function Perp() {
  useFocusEffect(() => {
    void backgroundApiProxy.serviceHyperliquid.updatePerpsConfigByServer();
    const timer = setTimeout(() => {
      void showHyperliquidTermsDialog();
    }, 600);
    return () => clearTimeout(timer);
  });
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <PerpsGlobalEffects />
        <PerpContent />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}
