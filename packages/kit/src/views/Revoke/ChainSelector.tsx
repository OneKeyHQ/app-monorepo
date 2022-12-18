import type { FC } from 'react';
import { useMemo } from 'react';

import {
  HStack,
  Icon,
  Select,
  Token,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { useManageNetworks } from '../../hooks';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export const RevokeChainSelector: FC<Props> = ({ value, onChange }) => {
  const { enabledNetworks } = useManageNetworks();
  const isVerticalLayout = useIsVerticalLayout();

  const options = useMemo(() => {
    if (!enabledNetworks) return [];

    return enabledNetworks
      .filter((n) => n.impl === 'evm')
      .map((network) => ({
        label: network.shortName,
        value: network.id,
        tokenProps: {
          token: {
            logoURI: network?.logoURI,
            name: network?.shortName,
          },
        },
      }));
  }, [enabledNetworks]);

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      dropdownProps={{ width: '64' }}
      dropdownPosition="right"
      footer={null}
      headerShown={false}
      renderTrigger={({ activeOption, isHovered }) => (
        <HStack
          p={2}
          space={1}
          bg={isHovered ? 'surface-hovered' : undefined}
          borderRadius="xl"
          alignItems="center"
          justifyContent={isVerticalLayout ? 'flex-end' : 'space-between'}
        >
          <HStack space={3} alignItems="center">
            <Token size={6} {...activeOption.tokenProps} />
          </HStack>
          <Icon size={20} name="ChevronDownMini" color="icon-subdued" />
        </HStack>
      )}
    />
  );
};
