import { useEffect, useRef } from 'react';

import LayoutHeader from './index';

import { Box, HStack, IconButton } from '@onekeyhq/components';
import { NetworkAccountSelectorTrigger } from '@onekeyhq/kit/src/components/NetworkAccountSelector';
import { useCheckUpdate } from '@onekeyhq/kit/src/hooks/useCheckUpdate';
import { showHomeMoreMenu } from '@onekeyhq/kit/src/views/Overlay/HomeMoreMenu';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

export function LayoutHeaderDesktop() {
  const moreBtnRef = useRef();
  const { showUpdateBadge } = useCheckUpdate();

  useEffect(() => {
    debugLogger.autoUpdate.debug(
      'LayoutHeaderDesktop showUpdateBadge effect: ',
      showUpdateBadge,
    );
  }, [showUpdateBadge]);

  return (
    <LayoutHeader
      showOnDesktop
      // headerLeft={() => <AccountSelector />}
      headerLeft={() => null}
      // headerRight={() => <ChainSelector />}
      // headerRight={() => <NetworkAccountSelectorTrigger />}
      headerRight={() => (
        <HStack space={2}>
          <NetworkAccountSelectorTrigger size="lg" />
          <Box ref={moreBtnRef}>
            <IconButton
              name="EllipsisVerticalOutline"
              size="lg"
              onPress={() => showHomeMoreMenu(moreBtnRef.current)}
              type="plain"
              circle
            />
            {showUpdateBadge && (
              <Box
                position="absolute"
                top="-3px"
                right="-8px"
                rounded="full"
                p="2px"
                pr="9px"
              >
                <Box rounded="full" bgColor="interactive-default" size="8px" />
              </Box>
            )}
          </Box>
        </HStack>
      )}
    />
  );
}
