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

import { useNetworkSimple } from '../../../hooks';
import { amountEditorTypeMap } from '../constants';
import {
  AmountTypeEnum,
  type BulkSenderRoutes,
  type BulkSenderRoutesParams,
  BulkTypeEnum,
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
  } = route.params;

  const deafaultIndex =
    amountEditorTypeMap[bulkType].indexOf(amountTypeFromOut);

  const [amountTypeIndex, setAmountTypeIndex] = useState(
    deafaultIndex > -1 ? deafaultIndex : 0,
  );

  const intl = useIntl();
  const network = useNetworkSimple(networkId);

  const useFormReturn = useForm<AmountEditorValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  const { control, formState, getValues } = useFormReturn;

  const isConfirmDisabeld = useMemo(() => {
    const amountType = amountEditorTypeMap[bulkType][amountTypeIndex];

    if (amountType === AmountTypeEnum.Fixed) {
      return !!formState.errors.amount;
    }

    if (amountType === AmountTypeEnum.Random) {
      return !!formState.errors.minAmount && !!formState.errors.maxAmount;
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
        amount: [minAmount, maxAmount],
        amountType,
      });
    } else {
      onAmountChanged({
        amount: [amount],
        amountType,
      });
    }
  }, [amountTypeIndex, bulkType, getValues, onAmountChanged]);

  const validateAmount = useCallback(
    (value) => {
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
    },
    [intl, network?.settings.minTransferAmount, token.decimals, token?.symbol],
  );

  const amountTypes = useMemo(
    () =>
      [
        'Fixed',
        ...(bulkType === BulkTypeEnum.OneToMany
          ? []
          : ['Random', intl.formatMessage({ id: 'action__max' })]),
        intl.formatMessage({ id: 'content__custom' }),
      ].filter(Boolean),
    [bulkType, intl],
  );

  const customAmountDesc = useMemo(
    () => (
      <>
        <Text>
          Customise transfer amount by adding the amount after the address (use
          commas to split).
        </Text>
        <Text mt={5} color="text-subdued">
          E.g.: 0x97a535f9825DcF3AA709FB2FdddE8d776e4Ebfc3, 1.1
        </Text>
      </>
    ),
    [],
  );

  const renderAmountEditorDetail = useCallback(() => {
    if (amountTypeIndex === 0) {
      return (
        <Form>
          <Form.Item
            name="amount"
            control={control}
            defaultValue={amountFromOut[0]}
            label={intl.formatMessage({ id: 'form__amount' })}
            rules={{
              required: true,
              validate: (value) => validateAmount(value),
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
        </Form>
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
        <Form>
          <Form.Item
            name="minAmount"
            control={control}
            defaultValue={amountFromOut[0]}
            label="Minimum Amount"
            rules={{
              required: true,
              validate: (value) => validateAmount(value),
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
            defaultValue={amountFromOut[0]}
            label="Maximum Amount"
            rules={{
              required: true,
              validate: (value) => validateAmount(value),
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
        </Form>
      );
    }

    if (amountTypeIndex === 2) {
      return (
        <Text>
          Fixed Random Max Custom Send maximum amount of USDC from the
          addresses.
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
          onChange={setAmountTypeIndex}
          values={amountTypes}
          tabStyle={{
            width: '120px',
          }}
        />
        <Box mt={5}>{renderAmountEditorDetail()}</Box>
      </Box>
    </Modal>
  );
}

export { AmountEditor };
