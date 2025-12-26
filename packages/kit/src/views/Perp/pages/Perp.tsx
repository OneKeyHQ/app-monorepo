import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Page,
  SizableText,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { TabletHomeContainer } from '@onekeyhq/kit/src/components/TabletHomeContainer';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeader } from '../../../components/TabPageHeader';
import { usePerpFeatureGuard } from '../../../hooks/usePerpFeatureGuard';
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
  if (gtMd && !platformEnv.isNative) {
    return <PerpDesktopLayout />;
  }
  return <PerpMobileLayout />;
}

function PerpContent() {
  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS ? 143 : 92,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const height = e.nativeEvent.layout.height - 20;
    setTabPageHeight(height);
  }, []);
  const intl = useIntl();

  const header = (
    <TabPageHeader
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Perp}
      customHeaderLeftItems={
        platformEnv.isWebDappMode ? undefined : (
          <SizableText size="$headingXl">
            {intl.formatMessage({ id: ETranslations.global_perp })}
          </SizableText>
        )
      }
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

function PerpView() {
  const isFocused = useIsFocused();
  const [isMounted, setIsMounted] = useState(false);
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (isMountedRef.current) {
      return;
    }
    if (isFocused) {
      isMountedRef.current = true;
      setIsMounted(true);
    }
  }, [isFocused]);
  if (!isMounted) {
    return null;
  }
  return shouldOpenExpandExtPerp ? (
    <ExtPerp />
  ) : (
    <>
      <PerpsGlobalEffects />
      <PerpContent />
    </>
  );
}

function ExtPerpNull() {
  const isFocused = useIsFocused();
  return isFocused ? <ExtPerp /> : null;
}

export default function Perp() {
  const canRenderPerp = usePerpFeatureGuard();
  if (!canRenderPerp) {
    return shouldOpenExpandExtPerp ? <ExtPerpNull /> : null;
  }

  return (
    <TabletHomeContainer>
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <PerpView />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    </TabletHomeContainer>
  );
}
