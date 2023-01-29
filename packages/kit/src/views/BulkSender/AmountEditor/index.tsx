import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  HStack,
  Icon,
  Input,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';

function AmountEditorBottomSheetModal({
  onAmountChanged,
  closeOverlay,
}: {
  onAmountChanged: (amount: string) => void;
  closeOverlay: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [isValid, setIsValid] = useState(true);

  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

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
    closeOverlay();
  }, [amount, closeOverlay, isValid, onAmountChanged]);

  return (
    <BottomSheetModal
      closeOverlay={closeOverlay}
      showCloseButton={!isVertical}
      title={intl.formatMessage({ id: 'action__edit_amount' })}
    >
      <Text typography="Body1" color="text-subdued" textAlign="center">
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
        <Button size="xl" flex={1} onPress={closeOverlay}>
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
    </BottomSheetModal>
  );
}

const showAmountEditor = (onAmountChanged: (amount: string) => void) => {
  showOverlay((close) => (
    <AmountEditorBottomSheetModal
      onAmountChanged={onAmountChanged}
      closeOverlay={close}
    />
  ));
};

export { showAmountEditor };
