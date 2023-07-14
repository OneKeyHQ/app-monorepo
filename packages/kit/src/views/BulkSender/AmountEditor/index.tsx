import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Form,
  Modal,
  SegmentedControl,
  Text,
  useForm,
} from '@onekeyhq/components';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';

import { useNetworkSimple } from '../../../hooks';
import { amountEditorTypeMap } from '../constants';
import {
  AmountTypeEnum,
  type BulkSenderRoutes,
  type BulkSenderRoutesParams,
} from '../types';

import type { AmountEditorValues } from '../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  BulkSenderRoutesParams,
  BulkSenderRoutes.AmountEditor
>;

function AmountEditor() {
  const route = useRoute<RouteProps>();
  const {
    onAmountChanged,
    amount: amountFromOut,
    amountType: amountTypeFromOut,
    bulkType,
    token,
    networkId,
    accountAddress,
  } = route.params;

  const deafaultIndex =
    amountEditorTypeMap[bulkType].indexOf(amountTypeFromOut);

  const [amountTypeIndex, setAmountTypeIndex] = useState(
    deafaultIndex > -1 ? deafaultIndex : 0,
  );

  const intl = useIntl();
  const network = useNetworkSimple(networkId);

  const useFormReturn = useForm<AmountEditorValues>({
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  const {
    control,
    formState,
    getValues,
    trigger: triggerForm,
    watch,
  } = useFormReturn;

  const isConfirmDisabeld = useMemo(() => {
    const amountType = amountEditorTypeMap[bulkType][amountTypeIndex];

    if (amountType === AmountTypeEnum.Fixed) {
      return !!formState.errors.amount;
    }

    if (amountType === AmountTypeEnum.Random) {
      return !!formState.errors.minAmount || !!formState.errors.maxAmount;
    }

    return false;
  }, [
    amountTypeIndex,
    bulkType,
    formState.errors.amount,
    formState.errors.maxAmount,
    formState.errors.minAmount,
  ]);

  const handleConfirmAmount = useCallback(() => {
    const amountType = amountEditorTypeMap[bulkType][amountTypeIndex];
    const { minAmount, maxAmount, amount } = getValues();

    if (amountType === AmountTypeEnum.Random) {
      onAmountChanged({
        amount: [minAmount || '0', maxAmount || '1'],
        amountType,
      });
    } else {
      onAmountChanged({
        amount: [amount || '0'],
        amountType,
      });
    }
  }, [amountTypeIndex, bulkType, getValues, onAmountChanged]);

  const validateAmount = useCallback(
    (value, type?: 'min' | 'max') => {
      const amountBN = new BigNumber(value);
      if (amountBN.isNegative()) {
        return intl.formatMessage({ id: 'msg__enter_a_number' });
      }

      if (!amountBN.shiftedBy(token.decimals).isInteger()) {
        return intl.formatMessage(
          {
            id: 'msg__please_limit_the_amount_of_tokens_to_str_decimal_places_or_less',
          },
          {
            '0': token.decimals,
          },
        );
      }

      if (network?.settings.minTransferAmount) {
        const minTransferAmountBN = new BigNumber(
          network.settings.minTransferAmount,
        );
        if (amountBN.lt(minTransferAmountBN)) {
          return intl.formatMessage(
            { id: 'form__str_minimum_transfer' },
            { 0: minTransferAmountBN.toFixed(), 1: token?.symbol },
          );
        }
      }

      if (type === 'min') {
        const maxValue = getValues('maxAmount');
        if (new BigNumber(maxValue).isLessThanOrEqualTo(value)) {
          return 'min value must be less than max value';
        }
      } else if (type === 'max') {
        const minValue = getValues('minAmount');
        if (new BigNumber(minValue).isGreaterThanOrEqualTo(value)) {
          return 'max value must be greater than min value';
        }
      }
    },
    [
      getValues,
      intl,
      network?.settings.minTransferAmount,
      token.decimals,
      token?.symbol,
    ],
  );

  const amountTypes = useMemo(
    () =>
      [
        intl.formatMessage({ id: 'form__fixed' }),
        ...(bulkType === BulkTypeEnum.OneToMany
          ? []
          : [
              intl.formatMessage({ id: 'form__random' }),
              intl.formatMessage({ id: 'form__max' }),
            ]),
        intl.formatMessage({ id: 'form__custom' }),
      ].filter(Boolean),
    [bulkType, intl],
  );

  const customAmountDesc = useMemo(
    () => (
      <Text>
        {`${intl.formatMessage({
          id: 'content__customise_transfer_amount_by_adding_the_amount_after_the_address',
        })} ${accountAddress}, 0.1`}
      </Text>
    ),
    [accountAddress, intl],
  );

  const watchAmount = watch(['minAmount', 'maxAmount']);
  const randomAmountDesc = useMemo(
    () =>
      intl.formatMessage(
        {
          id: 'content__the_amount_for_all_addresses_will_be_randomized_from_str_to_str',
        },
        {
          min_amount: watchAmount[0],
          max_amount: watchAmount[1],
        },
      ),
    [intl, watchAmount],
  );

  const renderAmountEditorDetail = useCallback(() => {
    if (amountTypeIndex === 0) {
      return (
        <Form.Item
          name="amount"
          control={control}
          defaultValue={amountFromOut[0] || '0'}
          label={intl.formatMessage({ id: 'form__amount' })}
          rules={{
            required: true,
            validate: (value) => validateAmount(value),
          }}
        >
          <Form.NumberInput
            placeholder={intl.formatMessage({ id: 'form__amount' })}
            rightCustomElement={
              <Text paddingRight={2} typography="Body1">
                {token?.symbol}
              </Text>
            }
          />
        </Form.Item>
      );
    }

    if (amountTypeIndex === 1 && bulkType === BulkTypeEnum.OneToMany) {
      return customAmountDesc;
    }

    if (
      amountTypeIndex === 1 &&
      (bulkType === BulkTypeEnum.ManyToMany ||
        bulkType === BulkTypeEnum.ManyToOne)
    ) {
      return (
        <>
          <Form.Item
            name="minAmount"
            control={control}
            defaultValue={amountFromOut[0] || '0'}
            label="Minimum Amount"
            rules={{
              required: true,
              validate: (value) => validateAmount(value, 'min'),
            }}
          >
            <Form.NumberInput
              rightCustomElement={
                <Text paddingRight={2} typography="Body1">
                  {token?.symbol}
                </Text>
              }
            />
          </Form.Item>
          <Form.Item
            name="maxAmount"
            control={control}
            defaultValue={amountFromOut[1] || '1'}
            label="Maximum Amount"
            rules={{
              required: true,
              validate: (value) => validateAmount(value, 'max'),
            }}
            helpText={randomAmountDesc}
          >
            <Form.NumberInput
              rightCustomElement={
                <Text paddingRight={2} typography="Body1">
                  {token?.symbol}
                </Text>
              }
            />
          </Form.Item>
        </>
      );
    }

    if (amountTypeIndex === 2) {
      return (
        <Text>
          {intl.formatMessage(
            {
              id: 'content__send_maximum_amount_of_str_from_the_addresses',
            },
            {
              token_symbol: token?.symbol,
            },
          )}
        </Text>
      );
    }

    if (amountTypeIndex === 3) {
      return customAmountDesc;
    }
  }, [
    amountFromOut,
    amountTypeIndex,
    bulkType,
    control,
    customAmountDesc,
    intl,
    randomAmountDesc,
    token?.symbol,
    validateAmount,
  ]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__edit_amount' })}
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{ isDisabled: isConfirmDisabeld }}
      onPrimaryActionPress={({ close }) => {
        handleConfirmAmount();
        close();
      }}
    >
      <Box flex={1}>
        <SegmentedControl
          selectedIndex={amountTypeIndex}
          onChange={(index) => {
            triggerForm();
            setAmountTypeIndex(index);
          }}
          values={amountTypes}
          tabStyle={{
            width: '120px',
          }}
        />
        <Form mt={5}>{renderAmountEditorDetail()}</Form>
      </Box>
    </Modal>
  );
}

export { AmountEditor };
