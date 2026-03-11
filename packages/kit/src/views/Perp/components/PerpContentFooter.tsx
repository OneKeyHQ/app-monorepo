import { useMemo } from 'react';

import { Page, XStack, useMedia } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpFooterActions } from '../../../components/Footer';
import { NetworkStatusBadge } from '../../../components/NetworkStatusBadge';
import { PerpRefreshButton } from '../../../components/PerpRefreshButton';

import { PerpFooterTicker } from './FooterTicker/PerpFooterTicker';

function PerpNetworkStatus() {
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const connected = Boolean(networkStatus?.connected);
  const pingMs = networkStatus?.pingMs;

  const monoLabel = useMemo(() => {
    if (connected && pingMs !== null && pingMs !== undefined) {
      return `${pingMs}ms`;
    }
    return undefined;
  }, [connected, pingMs]);

  return <NetworkStatusBadge connected={connected} monoLabel={monoLabel} />;
}

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
          p="$2"
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
