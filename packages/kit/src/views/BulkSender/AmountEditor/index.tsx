import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, HStack, Icon, Input, Modal, Text } from '@onekeyhq/components';

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
  const { onAmountChanged } = route.params;

  const intl = useIntl();

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
  }, [amount, isValid, onAmountChanged]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__edit_amount' })}
      onSecondaryActionPress={({ close }) => close()}
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__cancel"
      primaryActionProps={{ isDisabled: !isValid }}
      onPrimaryActionPress={({ close }) => {
        handleConfirmAmount();
        close();
      }}
    >
      <Box flex={1}>
        <Text typography="Body1" color="text-subdued" textAlign="center">
          {intl.formatMessage({
            id: 'content__this_will_be_applied_to_all_receiver_address_in_the_input',
          })}
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
              {intl.formatMessage({ id: 'msg__enter_a_number' })}
            </Text>
          </HStack>
        </Box>
      </Box>
    </Modal>
  );
}

export { AmountEditor };
