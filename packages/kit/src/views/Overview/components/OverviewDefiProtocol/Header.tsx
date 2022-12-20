import type { FC, ReactElement } from 'react';

import {
  Badge,
  Box,
  HStack,
  Icon,
  Pressable,
  Text,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { TokenIcon } from '@onekeyhq/components/src/Token';

import type B from 'bignumber.js';

export const OverviewDefiBoxHeader: FC<{
  rate: B;
  icon: string;
  name: string;
  desc: ReactElement;
  extra?: ReactElement;
  toggle?: () => void;
  collapsed?: boolean;
}> = ({ icon, name, rate, desc, extra, toggle, collapsed }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Box
      px={isVertical ? 4 : 6}
      py={isVertical ? 4 : 5}
      alignItems={isVertical ? 'flex-start' : 'center'}
      flexDirection={isVertical ? 'column' : 'row'}
    >
      <HStack flex="1" alignItems="center">
        <TokenIcon
          size={8}
          token={{
            logoURI: icon,
            name,
          }}
        />
        <Text fontSize="18px" color="text-default" fontWeight="600" ml="3">
          {name}
        </Text>
        {rate.isNaN() ? null : (
          <Badge ml="2" size="lg" title={`${rate.toFixed(2)}%`} />
        )}
      </HStack>
      <HStack alignItems="center">
        <VStack>
          {desc}
          {extra}
        </VStack>
        <Pressable onPress={toggle}>
          {collapsed ? (
            <Icon name="ChevronUpMini" size={20} />
          ) : (
            <Icon name="ChevronDownMini" size={20} />
          )}
        </Pressable>
      </HStack>
    </Box>
  );
};
