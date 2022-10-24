import React, { FC, useCallback } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  Token,
  Typography,
  VStack,
  useForm,
} from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';
import { BottomSheetSettings } from '../../Overlay/AccountValueSettings';

type Props = {
  dapp: {
    name: string;
    logoURI?: string;
  };
  spender: string;
  balance: B;
  symbol: string;
  allowance: string;
  update: (amount: string) => Promise<void>;
};

type FieldValues = {
  allowance: number;
  isUnlimited: boolean;
};

const ChangeAllowance: FC<
  Props & {
    closeOverlay: () => void;
  }
> = ({
  dapp,
  balance,
  symbol,
  update,
  allowance: beforeAllowance,
  closeOverlay,
}) => {
  const intl = useIntl();

  const { control, handleSubmit, watch } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: {
      allowance: beforeAllowance === 'unlimited' ? 0 : +beforeAllowance,
      isUnlimited: beforeAllowance === 'unlimited',
    },
  });

  const balanceStr = `${balance.toString()} ${symbol}`;

  const isUnlimited = watch('isUnlimited');

  const onSubmit = useCallback(
    async (values: FieldValues) => {
      if (values.isUnlimited) {
        await update('unlimited');
      } else {
        await update(String(values.allowance));
      }
      closeOverlay();
    },
    [update, closeOverlay],
  );

  return (
    <VStack>
      <Token token={dapp} size="5" showInfo />
      <Form mt="3">
        <Form.Item name="isUnlimited" control={control}>
          <Form.Switch
            isFullMode
            label={intl.formatMessage({ id: 'form__unlimited_allowance' })}
          />
        </Form.Item>
        {isUnlimited ? null : (
          <Form.Item
            name="allowance"
            label={intl.formatMessage({
              id: 'form__allowance',
            })}
            control={control}
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: 'form__field_is_required',
                }),
              },
            }}
          >
            <Form.Input type="number" />
          </Form.Item>
        )}
      </Form>
      <Typography.Body2 mt="2">{`${intl.formatMessage(
        { id: 'content__balance_str' },
        {
          0: balanceStr,
        },
      )}`}</Typography.Body2>
      <Button type="primary" w="full" mt="4" onPromise={handleSubmit(onSubmit)}>
        {intl.formatMessage({ id: 'action__change' })}
      </Button>
    </VStack>
  );
};

const showChangeAllowanceOverlay = (props: Props) => {
  showOverlay((closeOverlay) => (
    <BottomSheetSettings
      closeOverlay={closeOverlay}
      titleI18nKey="action__change_allowance"
    >
      <ChangeAllowance {...props} closeOverlay={closeOverlay} />
    </BottomSheetSettings>
  ));
};
export default showChangeAllowanceOverlay;
