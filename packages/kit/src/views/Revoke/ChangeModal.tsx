import { useCallback } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Form,
  Modal,
  Token,
  Typography,
  VStack,
  useForm,
} from '@onekeyhq/components';

import { useUpdateAllowance } from './hooks';
import { AssetType } from './types';

import type { RevokeRoutes, RevokeRoutesParams } from './types';
import type { RouteProp } from '@react-navigation/native';

type FieldValues = {
  allowance: string;
  isUnlimited: boolean;
};

type RouteProps = RouteProp<RevokeRoutesParams, RevokeRoutes.ChangeAllowance>;

export const ChangeModal = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const {
    dapp,
    balance,
    token,
    networkId,
    allowance: beforeAllowance,
  } = route.params;
  const updateAllowance = useUpdateAllowance({
    networkId,
    spender: dapp.spender,
    contract: token.tokenIdOnNetwork,
  });

  const { control, handleSubmit, watch } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: {
      allowance: beforeAllowance === 'unlimited' ? '0' : beforeAllowance,
      isUnlimited: beforeAllowance === 'unlimited',
    },
  });

  const balanceStr = `${balance} ${token.symbol}`;

  const isUnlimited = watch('isUnlimited');

  const update = useCallback(
    (amount: string) => {
      updateAllowance({
        amount,
        assetType: AssetType.tokens,
      });
    },
    [updateAllowance],
  );

  const onSubmit = useCallback(
    (values: FieldValues) => {
      if (values.isUnlimited) {
        update('unlimited');
      } else {
        update(String(values.allowance));
      }
    },
    [update],
  );

  return (
    <Modal
      header={intl.formatMessage({
        id: 'action__change_allowance',
      })}
      hideSecondaryAction
      onPrimaryActionPress={({ close }) => {
        close?.();
        setTimeout(() => {
          handleSubmit((values: FieldValues) => onSubmit(values))();
        }, 600);
      }}
      primaryActionTranslationId="action__change"
    >
      <VStack>
        <Token token={dapp} size={5} showInfo />
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
                pattern: {
                  value: /^\d+(\.\d+)?$/g,
                  message: intl.formatMessage({
                    id: 'form__enter_a_number_greater_than_or_equal_to_0',
                  }),
                },
                required: {
                  value: true,
                  message: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                },
              }}
            >
              <Form.Input type="string" />
            </Form.Item>
          )}
        </Form>
        <Typography.Body2 mt="2">{`${intl.formatMessage(
          { id: 'content__balance_str' },
          {
            0: balanceStr,
          },
        )}`}</Typography.Body2>
      </VStack>
    </Modal>
  );
};
