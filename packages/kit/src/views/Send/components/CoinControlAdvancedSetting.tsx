import type { FC } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  HStack,
  IconButton,
  Pressable,
  Switch,
  Text,
  VStack,
} from '@onekeyhq/components';

type Props = {
  isChecked: boolean;
  onToggleCoinControl: () => void;
};
const CoinControlAdvancedSetting: FC<Props> = ({
  isChecked,
  onToggleCoinControl,
}) => {
  const intl = useIntl();
  return (
    <VStack
      p={4}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="border-default"
      borderRadius="xl"
    >
      <HStack alignItems="center" justifyContent="space-between">
        <Text typography="Body1Strong">
          {intl.formatMessage({ id: 'form__coin_control' })}
        </Text>
        <Switch
          labelType="false"
          isChecked={isChecked}
          onToggle={onToggleCoinControl}
        />
      </HStack>
      <Divider my={4} />
      <Pressable>
        <HStack alignItems="center" justifyContent="space-between">
          <Text typography="Body2">
            {intl.formatMessage({ id: 'form__str_selected' }, { 0: '12' })}
          </Text>
          <HStack alignItems="center" mr="-10px">
            <Text typography="Body2">0.00006632 BTC</Text>
            <IconButton
              size="sm"
              name="ChevronRightMini"
              type="plain"
              iconColor="icon-subdued"
            />
          </HStack>
        </HStack>
      </Pressable>
    </VStack>
  );
};

export default CoinControlAdvancedSetting;
