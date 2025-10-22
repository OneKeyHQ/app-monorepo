import { useCallback, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import { Page, Stack, YStack, useMedia } from '@onekeyhq/components';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { HyperliquidTermsOverlay } from '../components/HyperliquidTerms';
import { PerpContentFooter } from '../components/PerpContentFooter';
import { PerpsGlobalEffects } from '../components/PerpsGlobalEffects';
import { PerpsHeaderRight } from '../components/TradingPanel/components/PerpsHeaderRight';
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
          <PerpContentFooter />
        </Stack>
      </Page.Body>
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
