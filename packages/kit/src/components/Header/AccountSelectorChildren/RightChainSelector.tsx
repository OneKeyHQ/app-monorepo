import React, { FC, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import SelectBottonBar from '@onekeyhq/components/src/SelectBottonBar';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { useManageNetworks } from '@onekeyhq/kit/src/hooks';

type Props = {
  selectedNetworkId: string;
  setSelectedNetworkId: (id: string) => void;
  activeWallet: null | Wallet;
};

export const AllNetwork = 'all';

const RightChainSelector: FC<Props> = ({
  selectedNetworkId,
  setSelectedNetworkId,
  activeWallet,
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { enabledNetworks } = useManageNetworks();

  const options = useMemo(() => {
    const availableNetworks =
      activeWallet === null
        ? enabledNetworks
        : enabledNetworks.filter(({ settings }) => {
            switch (activeWallet.type) {
              case 'hw':
                return settings.hardwareAccountEnabled;
              case 'imported':
                return settings.importedAccountEnabled;
              case 'watching':
                return settings.watchingAccountEnabled;
              default:
                return true; // HD accounts are always supported.
            }
          });
    const selectNetworkExists = availableNetworks.find(
      (network) => network.id === selectedNetworkId,
    );
    if (!selectNetworkExists)
      setTimeout(() => setSelectedNetworkId(AllNetwork));

    if (!availableNetworks) return [];

    const networks: SelectItem<string>[] = availableNetworks.map((network) => ({
      label: network.shortName,
      value: network.id,
      tokenProps: {
        src: network.logoURI,
        letter: network.shortName,
      },
      badge: network.impl === 'evm' ? 'EVM' : undefined,
    }));
    networks.unshift({
      label: intl.formatMessage({ id: 'option__all' }),
      value: AllNetwork,
      iconProps: {
        name: 'OptionListAllSolid',
        size: isVerticalLayout ? 32 : 24,
        color: 'surface-neutral-default',
      },
    });

    return networks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledNetworks, isVerticalLayout, intl, activeWallet]);
  console.log(options);
  return (
    <SelectBottonBar>
      {options.map((i) => (
        <Box key={i.value}>{i.value}</Box>
      ))}
    </SelectBottonBar>
  );
};

export default memo(RightChainSelector);
