import { useState } from 'react';

import {
  IconButton,
  Image,
  Page,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkStatusBadge } from '../../../components/NetworkStatusBadge';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { usePerpsLogo } from '../hooks/usePerpsLogo';

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

export function PerpContentFooter() {
  const { gtSm } = useMedia();
  const { poweredByHyperliquidLogo } = usePerpsLogo();

  if (gtSm && !platformEnv.isWeb) {
    return (
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
    );
  }

  // Small screen - floating network status at bottom left
  return gtSm ? null : (
    <Stack position="absolute" bottom="$4" left="$4" zIndex={100}>
      <PerpNetworkStatus />
    </Stack>
  );
}
