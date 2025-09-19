import { useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import { Image, Page, XStack, useMedia } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { PerpsGlobalEffects } from '../components/PerpsGlobalEffects';
import { PerpAccountPanel } from '../components/TradingPanel/panels/PerpAccountPanel';
import { PerpDesktopLayout } from '../layouts/PerpDesktopLayout';
import { PerpMobileLayout } from '../layouts/PerpMobileLayout';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';

function PerpLayout() {
  const { gtMd } = useMedia();
  if (gtMd) {
    return <PerpDesktopLayout />;
  }
  return <PerpMobileLayout />;
}

function PerpContentFooter() {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  return gtSm ? (
    <Page.Footer>
      <XStack
        borderTopWidth="$px"
        borderTopColor="$borderSubdued"
        bg="$bgApp"
        h={40}
        alignItems="center"
        p="$4"
        justifyContent="flex-end"
      >
        <Image
          source={
            themeVariant === 'light'
              ? require('../../../../assets/PoweredByHyperliquidLight.svg')
              : require('../../../../assets/PoweredByHyperliquidDark.svg')
          }
          size={170}
          resizeMode="contain"
        />
      </XStack>
    </Page.Footer>
  ) : null;
}

function PerpContent() {
  console.log('PerpContent render');

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Perp}
        customHeaderRightItems={
          <PerpsAccountSelectorProviderMirror>
            <PerpsProviderMirror>
              <PerpAccountPanel ifOnHeader />
            </PerpsProviderMirror>
          </PerpsAccountSelectorProviderMirror>
        }
      />
      <Page.Body>
        <PerpLayout />
      </Page.Body>
      <PerpContentFooter />
    </Page>
  );
}

export default function Perp() {
  useFocusEffect(() => {
    void backgroundApiProxy.serviceWebviewPerp.updateBuilderFeeConfigByServer();
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
