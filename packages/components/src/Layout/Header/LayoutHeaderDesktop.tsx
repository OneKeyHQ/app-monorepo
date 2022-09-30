import { useRef } from 'react';

import LayoutHeader from './index';

import { Box, HStack, IconButton } from '@onekeyhq/components';
import { NetworkAccountSelectorTrigger } from '@onekeyhq/kit/src/components/NetworkAccountSelector';
import { showHomeMoreMenu } from '@onekeyhq/kit/src/views/Overlay/HomeMoreMenu';

export function LayoutHeaderDesktop() {
  const moreBtnRef = useRef();
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
              name="DotsVerticalOutline"
              size="lg"
              onPress={() => showHomeMoreMenu(moreBtnRef.current)}
              type="plain"
              circle
            />
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
          </Box>
        </HStack>
      )}
    />
  );
}
