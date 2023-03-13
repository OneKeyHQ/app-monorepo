import type { FC } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Dialog, Input, Pressable, Text } from '@onekeyhq/components';

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
            <Input
              w="full"
              value={input}
              size="lg"
              rightCustomElement={
                <Pressable
                  onPress={() => {
                    setInput(total);
                  }}
                  justifyContent="center"
                  alignItems="center"
                  width="80px"
                  height="50px"
                >
                  <Text typography="Button1">
                    {intl.formatMessage({ id: 'action__max' })}
                  </Text>
                </Pressable>
              }
              onChangeText={(text) => setInput(text.trim())}
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
