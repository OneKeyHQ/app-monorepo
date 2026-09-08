import { Page, XStack, useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpFooterActions } from '../../../components/Footer';
import { PerpRefreshButton } from '../../../components/PerpRefreshButton';

import { PerpFooterTicker } from './FooterTicker/PerpFooterTicker';
import { PerpNetworkStatus } from './PerpNetworkStatus';

export function PerpContentFooter() {
  const { gtSm } = useMedia();

  if (!platformEnv.isNative && !platformEnv.isWebDappMode && gtSm) {
    return (
      <Page.Footer>
        <XStack
          borderTopWidth="$px"
          borderTopColor="$borderSubdued"
          bg="$bgApp"
          h={40}
          alignItems="center"
          pl="$2"
          pr="$6"
          gap="$2"
        >
          <XStack alignItems="center" gap="$2" flexShrink={0}>
            <PerpNetworkStatus />
            <PerpRefreshButton />
          </XStack>
          <PerpFooterTicker />
          <PerpFooterActions />
        </XStack>
      </Page.Footer>
    );
  }
}
