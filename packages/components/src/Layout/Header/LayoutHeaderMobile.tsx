import LayoutHeader from './index';

import { HStack, IconButton } from '@onekeyhq/components';
import { NetworkAccountSelectorTriggerMobile } from '@onekeyhq/kit/src/components/NetworkAccountSelector';
import WalletSelectorTrigger from '@onekeyhq/kit/src/components/WalletSelector/WalletSelectorTrigger/WalletSelectorTrigger';
import { showHomeMoreMenu } from '@onekeyhq/kit/src/views/Overlay/HomeMoreMenu';

export function LayoutHeaderMobile() {
  return (
    <LayoutHeader
      showOnDesktop={false}
      // headerLeft={() => <AccountSelector />}
      headerLeft={() => <WalletSelectorTrigger />}
      // headerRight={() => <ChainSelector />}
      headerRight={() => (
        <HStack space={3} alignItems="center">
          <NetworkAccountSelectorTriggerMobile />
          <IconButton
            name="EllipsisVerticalOutline"
            type="plain"
            size="lg"
            onPress={() => showHomeMoreMenu()}
            circle
            m={-2}
          />
        </HStack>
      )}
    />
  );
}
