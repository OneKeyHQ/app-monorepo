import { memo, useContext, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';

import { Checkbox, XStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { NETWORK_SHOW_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/networkConsts';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

import type { IServerNetworkMatch } from '../../types';

function NetworkListItem({ network }: { network: IServerNetworkMatch }) {
  const {
    networksState,
    setNetworksState,
    accountNetworkValues,
    accountNetworkValueCurrency,
    accountDeFiOverview,
  } = useContext(AllNetworksManagerContext);

  const isEnabledInAllNetworks = isEnabledNetworksInAllNetworks({
    networkId: network.id,
    disabledNetworks: networksState.disabledNetworks,
    enabledNetworks: networksState.enabledNetworks,
    isTestnet: network.isTestnet,
  });

  const handleToggle = () => {
    setNetworksState((prev) => ({
      enabledNetworks: {
        ...prev.enabledNetworks,
        [network.id]: !isEnabledInAllNetworks,
      },
      disabledNetworks: {
        ...prev.disabledNetworks,
        [network.id]: isEnabledInAllNetworks,
      },
    }));
  };

  const networkTotalValue = useMemo(() => {
    if (isUndefined(accountNetworkValues[network.id])) {
      return '0';
    }
    return new BigNumber(accountDeFiOverview[network.id]?.netWorth ?? 0)
      .plus(accountNetworkValues[network.id] ?? '0')
      .toFixed();
  }, [accountNetworkValues, accountDeFiOverview, network.id]);

  const showValue = new BigNumber(networkTotalValue || 0).gt(
    NETWORK_SHOW_VALUE_THRESHOLD_USD,
  );

  return (
    <ListItem
      h="$12"
      py="$0"
      onPress={handleToggle}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={network.logoURI}
          isCustomNetwork={network.isCustomNetwork}
          networkName={network.name}
          isAllNetworks={network.isAllNetworks}
          allNetworksIconProps={{
            color: '$iconActive',
          }}
          size="$8"
        />
      }
      title={network.name}
      titleMatch={network.titleMatch}
      testID={`all-networks-manager-item-${network.id}`}
    >
      <XStack gap="$3" alignItems="center">
        {showValue ? (
          <Currency
            hideValue
            numberOfLines={1}
            flexShrink={1}
            size="$bodyLgMedium"
            userSelect="none"
            sourceCurrency={accountNetworkValueCurrency}
          >
            {networkTotalValue || '0'}
          </Currency>
        ) : null}
        <Checkbox value={isEnabledInAllNetworks} onChange={handleToggle} />
      </XStack>
    </ListItem>
  );
}

export default memo(NetworkListItem);
