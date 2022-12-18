import type { ComponentProps, FC } from 'react';
import { useMemo } from 'react';

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
import type { Network } from '@onekeyhq/engine/src/types/network';
import { useManageNetworks } from '@onekeyhq/kit/src/hooks';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

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
  triggerSize?: 'sm' | 'lg' | string;
};
const ChainSelector: FC<Props> = ({
  tiggerProps,
  selectedNetwork,
  triggerSize,
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
        dropdownPosition="right"
        dropdownProps={isSmallScreen ? {} : { minW: '240px' }}
        headerShown={false}
        options={options}
        isTriggerPlain
        activatable
        footer={null}
        onChange={onChange}
        renderTrigger={({ isHovered, isPressed }) => (
          <Box m="-8px" {...tiggerProps}>
            <Row
              alignItems="center"
              p="8px"
              bgColor={
                // eslint-disable-next-line no-nested-ternary
                isPressed
                  ? 'surface-pressed'
                  : isHovered
                  ? 'surface-hovered'
                  : 'transparent'
              }
              borderRadius="xl"
            >
              <Token
                size={triggerSize === 'lg' ? '24px' : '20px'}
                token={{ logoURI: selectedNetwork?.logoURI }}
              />
              {!isSmallScreen && (
                <Text ml="8px" typography="Body2Strong">
                  {selectedNetwork?.name}
                </Text>
              )}
              <Box ml="4px">
                <Icon size={20} name="ChevronDownMini" color="icon-subdued" />
              </Box>
            </Row>
          </Box>
        )}
      />
    </Box>
  );
};

export default ChainSelector;
