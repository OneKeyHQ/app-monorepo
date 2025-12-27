import { Image, Page, Stack, XStack, useMedia } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkStatusBadge } from '../../../components/NetworkStatusBadge';
import { PerpRefreshButton } from '../../../components/PerpRefreshButton';
import { usePerpsLogo } from '../hooks/usePerpsLogo';

function PerpNetworkStatus() {
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const connected = Boolean(networkStatus?.connected);

  return <NetworkStatusBadge connected={connected} />;
}

export function PerpContentFooter() {
  const { gtSm } = useMedia();
  const { poweredByHyperliquidLogo } = usePerpsLogo();

  if (!platformEnv.isNative && !platformEnv.isWebDappMode && gtSm) {
    return (
      <Page.Footer>
        <XStack
          borderTopWidth="$px"
          borderTopColor="$borderSubdued"
          bg="$bgApp"
          h="$14"
          alignItems="center"
          pl="$5"
          pr="$2.5"
          justifyContent="space-between"
        >
          <PerpNetworkStatus />
          <PerpRefreshButton ml="$2" />
          <Stack flex={1} />
          <Image
            source={poweredByHyperliquidLogo}
            w={176}
            h={30}
            resizeMode="contain"
          />
        </XStack>
      </Page.Footer>
    );
  }
}
