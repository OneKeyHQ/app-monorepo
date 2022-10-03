import LayoutHeader from './index';

import { Box, HStack, IconButton } from '@onekeyhq/components';
import { NetworkAccountSelectorTrigger } from '@onekeyhq/kit/src/components/NetworkAccountSelector';
import WalletSelectorTrigger from '@onekeyhq/kit/src/components/WalletSelector/WalletSelectorTrigger/WalletSelectorTrigger';
import { useCheckUpdate } from '@onekeyhq/kit/src/hooks/useCheckUpdate';
import { showHomeMoreMenu } from '@onekeyhq/kit/src/views/Overlay/HomeMoreMenu';

export function LayoutHeaderMobile() {
  const { showUpdateBadge } = useCheckUpdate();
  return (
    <LayoutHeader
      showOnDesktop={false}
      // headerLeft={() => <AccountSelector />}
      headerLeft={() => <WalletSelectorTrigger />}
      // headerRight={() => <ChainSelector />}
      headerRight={() => (
        <HStack space={2}>
          <NetworkAccountSelectorTrigger type="basic" />
          <IconButton
            name="DotsVerticalSolid"
            onPress={() => showHomeMoreMenu()}
            circle
            size="sm"
          />
          {showUpdateBadge && (
            <Box position="absolute" top={0} rounded="full" p="2px" pr="9px">
              <Box rounded="full" bgColor="interactive-default" size="8px" />
            </Box>
          )}
        </HStack>
      )}
    />
  );
}
