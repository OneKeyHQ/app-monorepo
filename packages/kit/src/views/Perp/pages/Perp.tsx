import { useCallback, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import {
  IconButton,
  Image,
  Page,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkStatusBadge } from '../../../components/NetworkStatusBadge';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { HyperliquidTermsOverlay } from '../components/HyperliquidTerms';
import { PerpsGlobalEffects } from '../components/PerpsGlobalEffects';
import { PerpsHeaderRight } from '../components/TradingPanel/components/PerpsHeaderRight';
import { usePerpsLogo } from '../hooks/usePerpsLogo';
import { PerpDesktopLayout } from '../layouts/PerpDesktopLayout';
import { PerpMobileLayout } from '../layouts/PerpMobileLayout';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';

import { ExtPerp, shouldOpenExpandExtPerp } from './ExtPerp';

import type { LayoutChangeEvent } from 'react-native';

function PerpLayout() {
  const { gtMd } = useMedia();
  if (gtMd) {
    return <PerpDesktopLayout />;
  }
  return <PerpMobileLayout />;
}

function PerpNetworkStatus() {
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const connected = Boolean(networkStatus?.connected);

  return <NetworkStatusBadge connected={connected} />;
}

function FooterRefreshButton() {
  const actions = useHyperliquidActions();
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const [loading, setLoading] = useState(false);
  return (
    <IconButton
      loading={loading}
      disabled={!networkStatus.connected}
      ml="$2"
      icon="RefreshCwOutline"
      variant="tertiary"
      size="small"
      onPress={async () => {
        try {
          setLoading(true);
          await actions.current.refreshAllPerpsData();
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      }}
    />
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
        <FooterRefreshButton />
        <Stack flex={1} />
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

  const header = (
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
  );

  return (
    <Page>
      {platformEnv.isNative ? (
        <>
          <Stack h={tabPageHeight} />
          <YStack
            position="absolute"
            top={-20}
            left={0}
            bg="$bgApp"
            pt="$5"
            width="100%"
            onLayout={handleTabPageLayout}
            zIndex={FLOAT_NAV_BAR_Z_INDEX}
          >
            {header}
          </YStack>
        </>
      ) : (
        header
      )}
      <Page.Body>
        <Stack position="relative" flex={1}>
          <PerpLayout />
          <HyperliquidTermsOverlay />
        </Stack>
      </Page.Body>
      <PerpContentFooter />
    </Page>
  );
}

export default function Perp() {
  useFocusEffect(() => {
    void backgroundApiProxy.serviceHyperliquid.updatePerpsConfigByServer();
  });

  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        {shouldOpenExpandExtPerp() ? (
          <ExtPerp />
        ) : (
          <>
            <PerpsGlobalEffects />
            <PerpContent />
          </>
        )}
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}
