import type { FC, ReactElement } from 'react';
import { useMemo } from 'react';

import {
  HStack,
  Icon,
  IconButton,
  Pressable,
  Text,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { TokenIcon } from '@onekeyhq/components/src/Token';

import { OverviewBadge } from '../OverviewBadge';

import type B from 'bignumber.js';

export const OverviewDefiBoxHeader: FC<{
  rate: B;
  icon: string;
  name: string;
  url?: string;
  desc: ReactElement;
  extra?: ReactElement;
  toggle?: () => void;
  collapsed?: boolean;
  onOpenDapp?: () => void;
}> = ({ icon, name, rate, desc, extra, toggle, collapsed, onOpenDapp }) => {
  const isVertical = useIsVerticalLayout();
  const badge = useMemo(() => <OverviewBadge rate={rate} />, [rate]);
  if (isVertical) {
    return (
      <VStack
        px={4}
        py={4}
        alignItems="center"
        bg="surface-subdued"
        borderTopRadius="12px"
      >
        <HStack w="full" mb="2">
          <HStack alignItems="center" flex="1" justifyContent="space-around">
            <HStack flex="1">
              <TokenIcon
                size={6}
                token={{
                  logoURI: icon,
                  name,
                }}
              />
              <Text onPress={onOpenDapp} typography="Body1Strong" ml="2">
                {name}
              </Text>
              {rate.isNaN() ? null : badge}
            </HStack>
          </HStack>
          <IconButton
            type="plain"
            onPress={toggle}
            name={collapsed ? 'ChevronDownMini' : 'ChevronUpMini'}
          />
        </HStack>
        <VStack w="full">
          {desc}
          {extra}
        </VStack>
      </VStack>
    );
  }
  return (
    <HStack
      px={6}
      py={3}
      alignItems="center"
      bg="surface-subdued"
      borderTopRadius="12px"
    >
      <HStack alignItems="center" flex="1" justifyContent="space-around">
        <HStack flex="1">
          <TokenIcon
            size={8}
            token={{
              logoURI: icon,
              name,
            }}
          />
          <Text typography="Heading" ml="2" onPress={onOpenDapp}>
            {name}
          </Text>
          {rate.isNaN() ? null : badge}
        </HStack>
      </HStack>
      <Pressable onPress={toggle}>
        <HStack alignItems="center">
          <VStack>
            {desc}
            {extra}
          </VStack>
          {collapsed ? (
            <Icon name="ChevronDownMini" size={20} />
          ) : (
            <Icon name="ChevronUpMini" size={20} />
          )}
        </HStack>
      </Pressable>
    </HStack>
  );
};
