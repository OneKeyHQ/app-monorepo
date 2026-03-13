import { useCallback, useRef, useState } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Page,
  SizableText,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { TabletHomeContainer } from '@onekeyhq/kit/src/components/TabletHomeContainer';
import { DOWNLOAD_MOBILE_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { consumePerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { LazyPageContainer } from '../../../components/LazyPageContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useNativePerpFeatureGuard } from '../../../hooks/usePerpFeatureGuard';
import { PerpContentFooter } from '../components/PerpContentFooter';
import { PerpsActivityCenterAction } from '../components/PerpsActivityCenterAction';
import { PerpSettingsButton } from '../components/PerpSettingsButton';
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

function PerpBodyContent() {
  return (
    <Stack position="relative" flex={1}>
      <PerpLayout />
      <PerpContentFooter />
    </Stack>
  );
}

function PerpContent() {
  const firedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        defaultLogger.perp.common.pageView({
          source: consumePerpPageEnterSource(),
        });
      }
      return () => {
        firedRef.current = false;
      };
    }, []),
  );

  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS ? 143 : 92,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const height = e.nativeEvent.layout.height - 20;
    setTabPageHeight(height);
  }, []);
  const intl = useIntl();
  const handleDownloadApp = useCallback(() => {
    openUrlExternal(DOWNLOAD_MOBILE_APP_URL);
  }, []);

  const header = (
    <TabPageHeader
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Perp}
      headerPx="$4"
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
      customToolbarItems={
        <>
          <PerpsActivityCenterAction size="small" copyAsUrl />
          <PerpSettingsButton testID="perp-header-settings-button" />
          <HeaderIconButton
            icon="DownloadOutline"
            size="small"
            title={intl.formatMessage({
              id: ETranslations.global_download_app,
            })}
            onPress={handleDownloadApp}
          />
        </>
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
        <LazyPageContainer>
          <PerpBodyContent />
        </LazyPageContainer>
      </Page.Body>
    </Page>
  );
}

function PerpView() {
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
  const canRenderPerp = useNativePerpFeatureGuard();

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
