import React, { ComponentProps, FC, useMemo } from 'react';

import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Select,
  Text,
  Token,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { Network } from '@onekeyhq/engine/src/types/network';
import { useManageNetworks } from '@onekeyhq/kit/src/hooks';

const ChainSelectorNetWorks = [
  OnekeyNetwork.eth,
  OnekeyNetwork.bsc,
  OnekeyNetwork.optimism,
  OnekeyNetwork.polygon,
  OnekeyNetwork.arbitrum,
  OnekeyNetwork.avalanche,
];

type Props = {
  tiggerProps?: ComponentProps<typeof Box>;
  selectedNetwork: Network;
  onChange: (network: Network) => void;
};
const ChainSelector: FC<Props> = ({
  tiggerProps,
  selectedNetwork,
  onChange,
}) => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const { enabledNetworks: networks } = useManageNetworks();

  const options = useMemo(() => {
    if (!networks) return [];

    return networks
      .filter((network) =>
        // @ts-ignore
        ChainSelectorNetWorks.includes(network.id),
      )
      .map((network) => ({
        title: network.shortName,
        label: network.name,
        value: network,
        tokenProps: {
          token: {
            logoURI: network?.logoURI,
            name: network?.name,
          },
        },
      }));
  }, [networks]);

  return (
    <Box>
      <Select
        title={intl.formatMessage({ id: 'network__network' })}
        dropdownPosition="left"
        dropdownProps={isSmallScreen ? {} : { minW: '240px' }}
        headerShown={false}
        options={options}
        isTriggerPlain
        footer={null}
        activatable={false}
        onChange={onChange}
        renderTrigger={() => (
          <Row alignItems="center" space="4px" {...tiggerProps}>
            <Token size="20px" token={{ logoURI: selectedNetwork?.logoURI }} />
            {!isSmallScreen && (
              <Text typography="Body2Strong">{selectedNetwork?.name}</Text>
            )}
            <Icon size={20} name="ChevronDownSolid" />
          </Row>
        )}
      />
    </Box>
  );
};

export default ChainSelector;
