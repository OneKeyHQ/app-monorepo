import React, { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Modal,
  NumberInput,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';

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
  const onBlur = useCallback(() => {
    const value = new BigNumber(slippage);
    if (value.gt(0) && value.lt(50)) {
      backgroundApiProxy.dispatch(setSwapSlippagePercent(slippage));
    }
  }, [slippage]);
  const errorMsg = useMemo(() => {
    const value = new BigNumber(slippage);
    if (!slippage || value.gte(50) || value.eq(0)) {
      return intl.formatMessage({
        id: 'msg__enter_a_valid_slippage_percentage',
      });
    }
    if (value.lt(0.1)) {
      return intl.formatMessage({ id: 'msg__your_transaction_may_fail' });
    }
    if (value.gte(5) && value.lt(50)) {
      return intl.formatMessage({
        id: 'msg__your_transaction_may_be_frontrun',
      });
    }
  }, [slippage, intl]);
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
          onBlur={onBlur}
        />
        <HStack space="1">
          <Pressable
            onPress={() => onChange('1')}
            width="10"
            h="7"
            bg="surface-neutral-subdued"
            _pressed={{ bg: 'surface-selected' }}
            borderRadius="full"
            alignItems="center"
            justifyContent="center"
          >
            <Typography.Body2Strong>1%</Typography.Body2Strong>
          </Pressable>
          <Pressable
            onPress={() => onChange('2')}
            width="10"
            h="7"
            bg="surface-neutral-subdued"
            _pressed={{ bg: 'surface-selected' }}
            borderRadius="full"
            alignItems="center"
            justifyContent="center"
          >
            <Typography.Body2Strong>2%</Typography.Body2Strong>
          </Pressable>
          <Pressable
            onPress={() => onChange('3')}
            width="10"
            h="7"
            bg="surface-neutral-subdued"
            _pressed={{ bg: 'surface-selected' }}
            borderRadius="full"
            alignItems="center"
            justifyContent="center"
          >
            <Typography.Body2Strong>3%</Typography.Body2Strong>
          </Pressable>
        </HStack>
        {errorMsg ? <FormErrorMessage message={errorMsg} /> : null}
      </Box>
    </Modal>
  );
};

export default Setting;
