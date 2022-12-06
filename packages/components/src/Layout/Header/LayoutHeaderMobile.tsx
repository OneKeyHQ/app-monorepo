import LayoutHeader from './index';

import { HStack, IconButton } from '@onekeyhq/components';
import { NetworkAccountSelectorTrigger } from '@onekeyhq/kit/src/components/NetworkAccountSelector';
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
        <HStack space={2}>
          <NetworkAccountSelectorTrigger type="basic" />
          <IconButton
            name="EllipsisVerticalMini"
            onPress={() => showHomeMoreMenu()}
            circle
            size="sm"
          />
        </HStack>
      )}
    />
  );
}
