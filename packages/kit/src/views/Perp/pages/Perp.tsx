import { useFocusEffect } from '@react-navigation/native';

import { Image, Page, XStack, useMedia } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { PerpsGlobalEffects } from '../components/PerpsGlobalEffects';
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

function PerpContent() {
  useFocusEffect(() => {
    void backgroundApiProxy.serviceWebviewPerp.updateBuilderFeeConfigByServer();
  });

  const { gtSm } = useMedia();
  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Perp}
      />
      <Page.Body>
        <PerpLayout />
      </Page.Body>
      {gtSm ? (
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
              source={require('../../../../assets/PoweredByHyperliquid.svg')}
              size={170}
              resizeMode="contain"
            />
          </XStack>
        </Page.Footer>
      ) : null}
    </Page>
  );
}

export default function Perp() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror storeName={EJotaiContextStoreNames.perps}>
        <PerpsGlobalEffects />
        <PerpContent />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}
