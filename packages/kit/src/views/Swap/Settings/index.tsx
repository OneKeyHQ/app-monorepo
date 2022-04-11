import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
  Input,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSettings } from '../../../hooks/redux';
import { setSwapSlippagePercent } from '../../../store/reducers/settings';

const Setting = () => {
  const intl = useIntl();
  const { swapSlippagePercent } = useSettings();
  const onChange = useCallback((text: string) => {
    const input = text.trim().replace(/[^0-9]/g, '');
    backgroundApiProxy.dispatch(setSwapSlippagePercent(input));
  }, []);
  return (
    <Modal header={intl.formatMessage({ id: 'title__settings' })} footer={null}>
      <Box>
        <Typography.Body2>
          {intl.formatMessage({ id: 'form__slippage_tolerance' })}
        </Typography.Body2>
        <Input
          w="full"
          mt="1"
          mb="2"
          rightText="%"
          value={swapSlippagePercent || '3'}
          onChangeText={onChange}
        />
        <HStack space="1">
          <Pressable onPress={() => onChange('1')}>
            <Badge title="1%" size="sm" />
          </Pressable>
          <Pressable onPress={() => onChange('2')}>
            <Badge title="2%" size="sm" />
          </Pressable>
          <Pressable onPress={() => onChange('3')}>
            <Badge title="3%" size="sm" />
          </Pressable>
        </HStack>
      </Box>
    </Modal>
  );
};

export default Setting;
