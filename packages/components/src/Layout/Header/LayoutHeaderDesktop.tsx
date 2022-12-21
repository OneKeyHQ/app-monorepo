import { useCallback, useEffect, useRef } from 'react';

import LayoutHeader from './index';

import { Box, HStack, IconButton } from '@onekeyhq/components';
import { NetworkAccountSelectorTriggerDesktop } from '@onekeyhq/kit/src/components/NetworkAccountSelector';
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

  const headerRight = useCallback(
    () => (
      <HStack space={2} alignItems="center">
        <NetworkAccountSelectorTriggerDesktop />
        <Box ref={moreBtnRef}>
          <IconButton
            name="EllipsisVerticalOutline"
            size="lg"
            onPress={() => showHomeMoreMenu(moreBtnRef.current)}
            type="plain"
            circle
            m={-2}
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
    ),
    [showUpdateBadge],
  );

  return (
    <LayoutHeader
      showOnDesktop
      // headerLeft={() => <AccountSelector />}
      headerLeft={() => null}
      // headerRight={() => <ChainSelector />}
      // headerRight={() => <NetworkAccountSelectorTrigger />}
      headerRight={headerRight}
    />
  );
}
