import type { FC } from 'react';
import { useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Dialog, NumberInput, Text } from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';

type Props = {
  total: string;
  onConfirm: (amount: string) => void;
  closeOverlay: () => void;
};

const AmountInputDialog: FC<Props> = ({ total, onConfirm, closeOverlay }) => {
  const intl = useIntl();

  const [input, setInput] = useState('1');

  return (
    <Dialog
      hasFormInsideDialog
      visible
      footerButtonProps={{
        primaryActionTranslationId: 'action__confirm',
        primaryActionProps: {
          type: 'primary',
          isDisabled: input.length === 0,
        },
        onPrimaryActionPress: () => {
          onConfirm(input);
          closeOverlay();
        },
        onSecondaryActionPress: closeOverlay,
      }}
      contentProps={{
        input: (
          <Box w="full" mt="4">
            <Text typography="Body2Strong">
              {intl.formatMessage({ id: 'content__amount' })}
            </Text>
            <NumberInput
              w="full"
              size="lg"
              enableMaxButton
              value={input}
              onChangeText={(text) => {
                if (new BigNumber(text).lte(total) || text.length === 0) {
                  setInput(text);
                }
              }}
              onMaxChange={() => {
                setInput(total);
              }}
            />
            <Text mt="8px" typography="Body2" color="text-subdued">
              {`${intl.formatMessage({ id: 'content__total' })}: ${total}`}
            </Text>
          </Box>
        ),
      }}
    />
  );
};

export const showAmountInputDialog = (props: Omit<Props, 'closeOverlay'>) =>
  showOverlay((close) => <AmountInputDialog {...props} closeOverlay={close} />);
