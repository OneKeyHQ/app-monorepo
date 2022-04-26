import React, { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
  Modal,
  NumberInput,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSettings } from '../../../hooks/redux';
import { setSwapSlippagePercent } from '../../../store/reducers/settings';

const Setting = () => {
  const intl = useIntl();
  const { swapSlippagePercent } = useSettings();
  const [slippage, setSlippage] = useState(swapSlippagePercent || '3');
  const onChange = useCallback((text: string) => {
    setSlippage(text.trim());
  }, []);
  useEffect(() => {
    if (slippage) {
      backgroundApiProxy.dispatch(setSwapSlippagePercent(slippage));
    }
  }, [slippage]);
  return (
    <Modal header={intl.formatMessage({ id: 'title__settings' })} footer={null}>
      <Box>
        <Typography.Body2>
          {intl.formatMessage({ id: 'form__slippage_tolerance' })}
        </Typography.Body2>
        <NumberInput
          w="full"
          mt="1"
          mb="2"
          rightText="%"
          value={slippage}
          onChangeText={onChange}
        />
        <HStack space="1">
          <Pressable onPress={() => onChange('1')}>
            <Badge title="1%" size="lg" />
          </Pressable>
          <Pressable onPress={() => onChange('2')}>
            <Badge title="2%" size="lg" />
          </Pressable>
          <Pressable onPress={() => onChange('3')}>
            <Badge title="3%" size="lg" />
          </Pressable>
        </HStack>
      </Box>
    </Modal>
  );
};

export default Setting;
