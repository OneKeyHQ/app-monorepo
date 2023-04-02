import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { first, last } from 'lodash';
import { useIntl } from 'react-intl';

import { Form, Typography, useIsVerticalLayout } from '@onekeyhq/components';
import type {
  OneKeyError,
  OneKeyValidatorError,
} from '@onekeyhq/engine/src/errors';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type { IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';
import { calculateTotalFeeRange } from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useFormOnChangeDebounced } from '../../../../hooks/useFormOnChangeDebounced';
import { FeeTipsWarning } from '../../components/FeeTipsWarning';
import { SEND_EDIT_FEE_PRICE_UP_RATIO } from '../../utils/sendConfirmConsts';

import type { ISendEditFeeValues } from '../../types';
import type { UseFormReturn } from 'react-hook-form';

function printError(error: OneKeyError | any) {
  const e = error as OneKeyError;
  console.error({
    message: e.message,
    key: e.key,
    info: e.info,
    className: e.className,
  });
}

export type ICustomFeeFormProps = {
  feeInfoPayload: IFeeInfoPayload | null;
  useFormReturn: UseFormReturn<ISendEditFeeValues, any>;
  autoConfirmAfterFeeSaved: boolean | undefined;
  accountId: string;
  networkId: string;
};
export function SendEditFeeCustomForm(props: ICustomFeeFormProps) {
  const { feeInfoPayload, useFormReturn, autoConfirmAfterFeeSaved, networkId } =
    props;

  const { control, getValues } = useFormReturn;
  const intl = useIntl();
  const [totalFeeRange, setTotalFeeRange] = useState({
    max: '0',
    min: '0',
  });
  const selectedFeeInfo = feeInfoPayload?.selected;

  const feeSymbol = feeInfoPayload?.info?.feeSymbol || '';
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
  const lastPresetFeeInfo = last(feeInfoPayload?.info?.prices ?? []);
  const fistPresetFeeInfo = first(feeInfoPayload?.info?.prices ?? []);
  const isSmallScreen = useIsVerticalLayout();

  const [gasLimitTip, setGasLimitTip] = useState<string | undefined>(undefined);
  const [gasPriceTip, setGasPriceTip] = useState<string | undefined>(undefined);
  const [maxPriorityFeeTip, setMaxPriorityFeeTip] = useState<
    string | undefined
  >(undefined);
  const [maxFeeTip, setMaxFeeTip] = useState<string | undefined>(undefined);

  const updateTotalFeeRange = useCallback(() => {
    let feeRange;
    if (isEIP1559Fee) {
      feeRange = calculateTotalFeeRange({
        eip1559: true,
        limit: getValues('gasLimit'),
        price1559: {
          baseFee: getValues('baseFee'),
          maxFeePerGas: getValues('maxFeePerGas'),
          maxPriorityFeePerGas: getValues('maxPriorityFeePerGas'),
        },
      });
    } else {
      feeRange = calculateTotalFeeRange({
        limit: getValues('gasLimit'),
        price: getValues('gasPrice'),
      });
    }
    setTotalFeeRange(feeRange);
  }, [getValues, isEIP1559Fee]);

  useFormOnChangeDebounced<ISendEditFeeValues>({
    useFormReturn,
    revalidate: true,
    onChange: updateTotalFeeRange,
  });

  useEffect(() => {
    updateTotalFeeRange();
  }, [updateTotalFeeRange]);

  return (
    <Form mt={8}>
      {isEIP1559Fee && (
        <Form.Item
          label={`${intl.formatMessage({
            id: 'content__base_fee',
          })} (${feeSymbol})`}
          control={control}
          name="baseFee"
          defaultValue=""
          formControlProps={{
            isReadOnly: true,
          }}
        >
          <Form.Input
            w="100%"
            rightText=""
            bgColor="surface-neutral-subdued"
            size={isSmallScreen ? 'xl' : undefined}
            isReadOnly
          />
        </Form.Item>
      )}
      {isEIP1559Fee && (
        <Form.Item
          label={`${intl.formatMessage({
            id: 'content__max_priority_fee',
          })} (${feeSymbol})`}
          control={control}
          name="maxPriorityFeePerGas"
          defaultValue=""
          rules={{
            validate: async (value) => {
              const lowFee = fistPresetFeeInfo as EIP1559Fee;
              const highFee = lastPresetFeeInfo as EIP1559Fee;

              // getValues
              try {
                await backgroundApiProxy.validator.validateMaxPriortyFee({
                  networkId,
                  value,
                  lowValue: lowFee?.maxPriorityFeePerGas,
                  highValue: highFee?.maxPriorityFeePerGas,
                  minValue:
                    autoConfirmAfterFeeSaved &&
                    selectedFeeInfo?.custom?.price1559
                      ? new BigNumber(
                          (
                            selectedFeeInfo?.custom?.price1559 as
                              | EIP1559Fee
                              | undefined
                          )?.maxPriorityFeePerGas as string,
                        )
                          .times(SEND_EDIT_FEE_PRICE_UP_RATIO)
                          .toFixed()
                      : '0',
                });
                setMaxPriorityFeeTip(undefined);
              } catch (error) {
                printError(error);
                const e = error as OneKeyError;

                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  setMaxPriorityFeeTip(undefined);
                  return intl.formatMessage(
                    {
                      id: e.key as any,
                    },
                    e.info,
                  );
                }
                if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                  setMaxPriorityFeeTip(
                    intl.formatMessage(
                      {
                        id: e.key as any,
                      },
                      e.info,
                    ),
                  );
                }
              }
              return true;
            },
          }}
          helpText={
            maxPriorityFeeTip && <FeeTipsWarning message={maxPriorityFeeTip} />
          }
        >
          <Form.NumberInput
            rightText=""
            size={isSmallScreen ? 'xl' : undefined}
          />
        </Form.Item>
      )}
      {isEIP1559Fee && (
        <Form.Item
          label={`${intl.formatMessage({
            id: 'content__max_fee',
          })} (${feeSymbol})`}
          control={control}
          name="maxFeePerGas"
          defaultValue=""
          rules={{
            validate: async (value) => {
              const lowFee = fistPresetFeeInfo as EIP1559Fee;
              const highFee = lastPresetFeeInfo as EIP1559Fee;
              try {
                await backgroundApiProxy.validator.validateMaxFee({
                  networkId,
                  maxPriorityFee: getValues('maxPriorityFeePerGas'),
                  value,
                  lowValue: lowFee?.maxFeePerGas,
                  highValue: highFee?.maxFeePerGas,
                  minValue:
                    autoConfirmAfterFeeSaved &&
                    selectedFeeInfo?.custom?.price1559
                      ? new BigNumber(
                          (
                            selectedFeeInfo?.custom?.price1559 as
                              | EIP1559Fee
                              | undefined
                          )?.maxFeePerGas as string,
                        )
                          .times(SEND_EDIT_FEE_PRICE_UP_RATIO)
                          .toFixed()
                      : '0',
                });
                setMaxFeeTip(undefined);
              } catch (error) {
                printError(error);
                const e = error as OneKeyValidatorError;
                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  setMaxFeeTip(undefined);
                  return intl.formatMessage(
                    {
                      id: e.key as any,
                    },
                    e.info,
                  );
                }

                if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                  setMaxFeeTip(
                    intl.formatMessage(
                      {
                        id: e.key as any,
                      },
                      e.info,
                    ),
                  );
                }
              }
              return true;
            },
          }}
          helpText={maxFeeTip && <FeeTipsWarning message={maxFeeTip} />}
        >
          <Form.NumberInput
            rightText=""
            size={isSmallScreen ? 'xl' : undefined}
          />
        </Form.Item>
      )}

      {!isEIP1559Fee && (
        <Form.Item
          label={intl.formatMessage({ id: 'content__gas_price' })}
          control={control}
          name="gasPrice"
          rules={{
            validate: async (value) => {
              const lowValue = fistPresetFeeInfo as string;
              const highValue = lastPresetFeeInfo as string;
              try {
                await backgroundApiProxy.validator.validateGasPrice({
                  networkId,
                  value,
                  minValue:
                    autoConfirmAfterFeeSaved && selectedFeeInfo?.custom?.price
                      ? new BigNumber(selectedFeeInfo?.custom?.price)
                          .times(SEND_EDIT_FEE_PRICE_UP_RATIO)
                          .toFixed()
                      : '0',
                  lowValue,
                  highValue,
                });
                setGasPriceTip(undefined);
              } catch (error) {
                printError(error);
                const e = error as OneKeyError;
                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  setGasPriceTip(undefined);
                  return intl.formatMessage(
                    {
                      id: e.key as any,
                    },
                    e.info,
                  );
                }
                if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                  setGasPriceTip(
                    intl.formatMessage(
                      {
                        id: e.key as any,
                      },
                      e.info,
                    ),
                  );
                }
              }
              return true;
            },
          }}
          defaultValue=""
          helpText={gasPriceTip && <FeeTipsWarning message={gasPriceTip} />}
        >
          <Form.NumberInput size={isSmallScreen ? 'xl' : undefined} />
        </Form.Item>
      )}

      <Form.Item
        label={intl.formatMessage({ id: 'content__gas_limit' })}
        control={control}
        name="gasLimit"
        rules={{
          validate: async (value) => {
            const limitCalculated = feeInfoPayload?.info?.limit;
            try {
              await backgroundApiProxy.validator.validateGasLimit({
                networkId,
                value,
                highValue: limitCalculated,
              });
              setGasLimitTip(undefined);
            } catch (error) {
              printError(error);
              const e = error as OneKeyError;

              if (e?.className === OneKeyErrorClassNames.OneKeyValidatorError) {
                setGasLimitTip(undefined);
                return intl.formatMessage(
                  {
                    id: e.key as any,
                  },
                  e.info,
                );
              }
              if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                setGasLimitTip(
                  intl.formatMessage(
                    {
                      id: e.key as any,
                    },
                    e.info,
                  ),
                );
              }
            }
            return true;
          },
        }}
        defaultValue=""
        helpText={gasLimitTip && <FeeTipsWarning message={gasLimitTip} />}
      >
        <Form.NumberInput size={isSmallScreen ? 'xl' : undefined} />
      </Form.Item>

      <Form.Item
        name="totalFee"
        control={control}
        label={intl.formatMessage({ id: 'content__fee' })}
      >
        <Typography.Body2 color="text-subdued">
          {totalFeeRange.min === totalFeeRange.max
            ? totalFeeRange.max
            : `${totalFeeRange.min} - ${totalFeeRange.max}`}{' '}
          {feeSymbol}
        </Typography.Body2>
      </Form.Item>
    </Form>
  );
}
