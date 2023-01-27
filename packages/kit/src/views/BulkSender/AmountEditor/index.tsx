import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  Input,
  Modal,
  Text,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';

import type { BulkSenderRoutes, BulkSenderRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  BulkSenderRoutesParams,
  BulkSenderRoutes.AmountEditor
>;

function AmountEditor() {
  const [amount, setAmount] = useState('');
  const [isValid, setIsValid] = useState(true);

  const route = useRoute<RouteProps>();
  const intl = useIntl();
  const modalClose = useModalClose();

  const { onAmountChanged } = route.params;

  useEffect(() => {
    if (amount === '') {
      setIsValid(true);
      return;
    }
    const amountBN = new BigNumber(amount);
    setIsValid(amountBN.isPositive());
  }, [amount]);

  const handleConfirmAmount = useCallback(() => {
    if (!isValid) return;
    onAmountChanged(amount);
    modalClose();
  }, [amount, isValid, modalClose, onAmountChanged]);

  return (
    <Modal headerShown={false} footer={null}>
      <Text typography="DisplayMedium" textAlign="center">
        {intl.formatMessage({ id: 'action__edit_amount' })}
      </Text>
      <Text typography="Body1" color="text-subdued" textAlign="center" mt={2}>
        {intl.formatMessage({ id: 'modal__reset_app_desc' })}
      </Text>
      <Box mt={5}>
        <Input
          w="full"
          size="xl"
          placeholder={intl.formatMessage({ id: 'content__amount' })}
          value={amount}
          onChangeText={setAmount}
        />
        <HStack
          mt={2}
          space="10px"
          alignItems="center"
          opacity={isValid ? 0 : 1}
        >
          <Icon
            name="InformationCircleOutline"
            size={14}
            color="icon-warning"
          />
          <Text typography="Caption" color="text-warning">
            {intl.formatMessage({ id: 'action__cancel' })}
          </Text>
        </HStack>
      </Box>
      <HStack mt={6} space={3}>
        <Button size="xl" flex={1} onPress={modalClose}>
          {intl.formatMessage({ id: 'action__cancel' })}
        </Button>
        <Button
          isDisabled={!isValid || amount === ''}
          size="xl"
          type="primary"
          flex={1}
          onPress={handleConfirmAmount}
        >
          {intl.formatMessage({ id: 'action__confirm' })}
        </Button>
      </HStack>
    </Modal>
  );
}

export { AmountEditor };
