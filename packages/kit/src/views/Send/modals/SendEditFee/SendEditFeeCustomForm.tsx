import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { first, last } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebounce } from 'use-debounce';

import {
  Alert,
  Badge,
  Box,
  Button,
  CheckBox,
  Form,
  HStack,
  Slider,
  Text,
  Tooltip,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type {
  OneKeyError,
  OneKeyValidatorError,
} from '@onekeyhq/engine/src/errors';
import {
  NotImplemented,
  OneKeyErrorClassNames,
} from '@onekeyhq/engine/src/errors';
import { getBlockNativeGasInfo } from '@onekeyhq/engine/src/managers/blockNative';
import type { BlockNativeGasInfo } from '@onekeyhq/engine/src/types/blockNative';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type {
  IEncodedTx,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useFormOnChangeDebounced } from '../../../../hooks/useFormOnChangeDebounced';
import { BlockNativeFeeInfoPanel } from '../../components/BlockNativeFeeInfoPanel';
import { LabelWithTooltip } from '../../components/LableWithTooltip';
import { SendEditFeeOverview } from '../../components/SendEditFeeOverview';
import { getConfidenceInfoLevel } from '../../utils/getConfidenceInfoLevel';
import {
  FEE_INFO_POLLING_INTERVAL,
  FEE_LEVEL_BADGE_TYPE_MAP,
  SEND_EDIT_FEE_PRICE_UP_RATIO,
} from '../../utils/sendConfirmConsts';
import {
  useBtcCustomFee,
  useBtcCustomFeeForm,
} from '../../utils/useBtcCustomFee';
import { useSolCustomFee } from '../../utils/useSolCustomFee';

import type { ISendEditFeeValues } from '../../types';
import type { UseFormReturn } from 'react-hook-form';

type AlertType = ComponentProps<typeof Alert>['alertType'];

export type CustomAlert = {
  type: AlertType;
  message: string;
} | null;

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
  blockNativeInit: boolean;
  setBlockNativeInit: (value: boolean) => void;
  saveCustom: boolean;
  setSaveCustom: (value: boolean) => void;
  encodedTx?: IEncodedTx;
};

const DEBOUNCED_PRIORITY_BOOSTER_TIMEOUT = platformEnv.isNative ? 250 : 0;
export function SendEditFeeCustomForm(props: ICustomFeeFormProps) {
  const {
    feeInfoPayload,
    useFormReturn,
    autoConfirmAfterFeeSaved,
    networkId,
    accountId,
    blockNativeInit,
    setBlockNativeInit,
    saveCustom,
    setSaveCustom,
    encodedTx,
  } = props;

  const {
    control,
    getValues,
    setValue,
    trigger: formTrigger,
    watch,
  } = useFormReturn;
  const { formValues } = useFormOnChangeDebounced<ISendEditFeeValues>({
    useFormReturn,
  });

  const intl = useIntl();

  const originLimit = feeInfoPayload?.info?.limit ?? '21000';

  const selectedFeeInfo = feeInfoPayload?.selected;

  const feeSymbol = feeInfoPayload?.info?.feeSymbol || '';
  const nativeSymbol = feeInfoPayload?.info?.nativeSymbol || '';
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
  const isBtcForkChain = feeInfoPayload?.info.isBtcForkChain;
  const isSolChain = feeInfoPayload?.info.isSolChain;
  const isSmallScreen = useIsVerticalLayout();

  const [lastPresetFeeInfo, setLastPresetFeeInfo] = useState(
    last(feeInfoPayload?.info?.prices ?? []),
  );
  const [firstPresetFeeInfo, setFirstPresetFeeInfo] = useState(
    first(feeInfoPayload?.info?.prices ?? []),
  );

  const [priorityBooster, setPriorityBooster] = useState<number>(1);
  const [debouncedPriorityBooster] = useDebounce(
    priorityBooster,
    DEBOUNCED_PRIORITY_BOOSTER_TIMEOUT,
  );

  const [basePriority, setBasePriority] = useState(
    (lastPresetFeeInfo as EIP1559Fee)?.maxPriorityFeePerGas,
  );

  const [gasLimitTip, setGasLimitTip] = useState<CustomAlert>(null);
  const [gasPriceTip, setGasPriceTip] = useState<CustomAlert>(null);
  const [maxPriorityFeeTip, setMaxPriorityFeeTip] = useState<CustomAlert>(null);
  const [maxFeeTip, setMaxFeeTip] = useState<CustomAlert>(null);
  const [blockNativeFeeInfo, setBlockNativeFeeInfo] =
    useState<BlockNativeGasInfo>();

  const maxFeeTouched = useRef(false);

  const { feeRateFormValidator } = useBtcCustomFeeForm({
    networkId,
    accountId,
    encodedTx,
    setGasPriceTip,
    firstPresetFeeInfo: firstPresetFeeInfo as string,
    lastPresetFeeInfo: lastPresetFeeInfo as string,
  });
  const watchFeeRate = watch('feeRate');
  const { btcTxFee } = useBtcCustomFee({
    networkId,
    accountId,
    encodedTx,
    feeRate: watchFeeRate,
    feeType: 'custom',
  });
  const { solLimit, solPrice } = useSolCustomFee({
    networkId,
    accountId,
    computeUnitPrice: watch('computeUnitPrice'),
    feeType: 'custom',
    encodedTx,
  });

  const handleBoosterOnChange = useCallback(
    (value) => {
      setPriorityBooster(value);

      const maxPriorityFeePerGas = new BigNumber(basePriority ?? 0).times(
        value,
      );

      setValue('maxPriorityFeePerGas', maxPriorityFeePerGas.toFixed());

      if (!formValues?.baseFee) return;

      const maxFee = maxPriorityFeePerGas.plus(formValues?.baseFee ?? 0);

      if (maxFee.isGreaterThanOrEqualTo(formValues?.maxFeePerGas ?? 0)) {
        setValue('maxFeePerGas', maxFee.plus(1).toFixed());
        maxFeeTouched.current = true;
      } else if (maxFeeTouched.current) {
        setValue('maxFeePerGas', maxFee.plus(1).toFixed());
      }
    },
    [basePriority, formValues?.baseFee, formValues?.maxFeePerGas, setValue],
  );

  const customFeeOverview = useMemo(() => {
    if (!formValues) return null;
    let limit = formValues.gasLimit;
    let price = null;
    if (isEIP1559Fee) {
      price = {
        baseFee: formValues?.baseFee,
        maxFeePerGas: formValues?.maxFeePerGas,
        maxPriorityFeePerGas: formValues?.maxPriorityFeePerGas,
      };
    } else if (isSolChain && solPrice && solLimit) {
      price = solPrice;
      limit = solLimit;
    } else {
      price = formValues?.gasPrice;
    }
    return (
      <SendEditFeeOverview
        accountId={accountId}
        networkId={networkId}
        feeInfo={feeInfoPayload?.info}
        price={price}
        limit={limit}
        btcCustomFee={btcTxFee}
      />
    );
  }, [
    formValues,
    isEIP1559Fee,
    isSolChain,
    solPrice,
    solLimit,
    accountId,
    networkId,
    feeInfoPayload?.info,
    btcTxFee,
  ]);

  const customConfidence = useMemo(() => {
    if (!isEIP1559Fee || !blockNativeFeeInfo?.prices || !formValues)
      return null;

    let confidence;
    let isMax = false;
    let isMin = false;
    const { prices } = blockNativeFeeInfo;
    const currentMaxFee = new BigNumber(formValues.maxFeePerGas);
    const currentPriority = new BigNumber(formValues.maxPriorityFeePerGas);

    for (let i = 0, len = prices.length; i < len; i += 1) {
      const price = prices[i];
      if (
        currentMaxFee.isGreaterThanOrEqualTo(price.maxFeePerGas) &&
        currentPriority.isGreaterThanOrEqualTo(price.maxPriorityFeePerGas)
      ) {
        if (
          i === 0 &&
          currentMaxFee.isGreaterThan(price.maxFeePerGas) &&
          currentPriority.isGreaterThan(price.maxPriorityFeePerGas)
        ) {
          isMax = true;
          confidence = price.confidence;
        } else {
          confidence = price.confidence;
        }
        break;
      }
    }
    if (!confidence) {
      isMin = true;
      confidence = last(prices)?.confidence;
    }

    return (
      <Badge
        mt={2}
        size="lg"
        type={FEE_LEVEL_BADGE_TYPE_MAP[getConfidenceInfoLevel(confidence ?? 0)]}
        title={intl.formatMessage(
          { id: 'form__str_probability' },
          { 0: `${isMax ? '>' : ''}${isMin ? '<' : ''}${confidence ?? 0}%` },
        )}
      />
    );
  }, [blockNativeFeeInfo, formValues, intl, isEIP1559Fee]);

  const customForm = useMemo(() => {
    const maxFeeInNative = new BigNumber(formValues?.maxFeePerGas ?? 0)
      .times(formValues?.gasLimit || 0)
      .shiftedBy(-(feeInfoPayload?.info.feeDecimals || 0))
      .toFixed(8);
    const maxPriorityFeeInNative = new BigNumber(
      formValues?.maxPriorityFeePerGas || 0,
    )
      .times(formValues?.gasLimit || 0)
      .shiftedBy(-(feeInfoPayload?.info.feeDecimals ?? 0))
      .toFixed(8);

    if (isBtcForkChain) {
      return (
        <Form mt={4}>
          <Form.Item
            label="Fee rate (sat/vB)"
            control={control}
            name="feeRate"
            rules={{
              validate: async (value) => feeRateFormValidator({ value }),
            }}
          >
            <Form.NumberInput size={isSmallScreen ? 'xl' : 'lg'} />
          </Form.Item>
        </Form>
      );
    }

    if (isSolChain) {
      return (
        <Form mt={4}>
          <Form.Item
            label={`${intl.formatMessage({
              id: 'form__prioritization_fee_sol',
            })} (microLamports)`}
            control={control}
            name="computeUnitPrice"
            rules={{
              min: 0,
              required: true,
            }}
          >
            <Form.NumberInput size={isSmallScreen ? 'xl' : 'lg'} />
          </Form.Item>
        </Form>
      );
    }

    return (
      <Form mt={4}>
        {isEIP1559Fee && (
          <Form.Item
            label={
              <LabelWithTooltip
                labelId="content__max_fee"
                tooltipId="content__custom_gas_max_fee_desc"
                labelAfter={` (${feeSymbol})`}
              />
            }
            control={control}
            name="maxFeePerGas"
            defaultValue=""
            rules={{
              validate: async (value) => {
                const lowFee = firstPresetFeeInfo as EIP1559Fee;
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
                  setMaxFeeTip(null);
                } catch (error) {
                  printError(error);
                  const e = error as OneKeyValidatorError;
                  if (
                    e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                  ) {
                    setMaxFeeTip({
                      type: 'error',
                      message: intl.formatMessage(
                        {
                          id: e.key as any,
                        },
                        e.info,
                      ),
                    });
                    return false;
                  }

                  if (
                    e?.className === OneKeyErrorClassNames.OneKeyValidatorTip
                  ) {
                    setMaxFeeTip({
                      type: 'warn',
                      message: intl.formatMessage(
                        {
                          id: e.key as any,
                        },
                        e.info,
                      ),
                    });
                  }
                }
                return true;
              },
            }}
          >
            <Form.NumberInput
              rightCustomElement={
                <Text
                  paddingRight={2}
                  typography="Body1"
                  color="text-subdued"
                >{`~${maxFeeInNative} ${nativeSymbol}`}</Text>
              }
              size={isSmallScreen ? 'xl' : 'lg'}
            />
          </Form.Item>
        )}
        {isEIP1559Fee && (
          <>
            <Form.Item
              label={
                <LabelWithTooltip
                  labelId="content__max_priority_fee"
                  tooltipId="content__custom_gas_priority_fee_desc"
                  labelAfter={` (${feeSymbol})`}
                />
              }
              control={control}
              name="maxPriorityFeePerGas"
              defaultValue=""
              rules={{
                validate: async (value) => {
                  const lowFee = firstPresetFeeInfo as EIP1559Fee;
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
                    setMaxPriorityFeeTip(null);
                  } catch (error) {
                    printError(error);
                    const e = error as OneKeyError;

                    if (
                      e?.className ===
                      OneKeyErrorClassNames.OneKeyValidatorError
                    ) {
                      setMaxPriorityFeeTip({
                        type: 'error',
                        message: intl.formatMessage(
                          {
                            id: e.key as any,
                          },
                          e.info,
                        ),
                      });
                      return false;
                    }
                    if (
                      e?.className === OneKeyErrorClassNames.OneKeyValidatorTip
                    ) {
                      setMaxPriorityFeeTip({
                        type: 'warn',
                        message: intl.formatMessage(
                          {
                            id: e.key as any,
                          },
                          e.info,
                        ),
                      });
                    }
                  }
                  return true;
                },
              }}
            >
              <Form.NumberInput
                mb={0}
                rightCustomElement={
                  <Text
                    paddingRight={2}
                    typography="Body1"
                    color="text-subdued"
                  >{`~${maxPriorityFeeInNative} ${nativeSymbol}`}</Text>
                }
                size={isSmallScreen ? 'xl' : 'lg'}
              />
            </Form.Item>
            <HStack alignItems="center" width="100%" space={8} mt={-4}>
              <LabelWithTooltip
                labelId="form__priority_fee_booster"
                tooltipId="content__custom_gas_priority_fee_booster_desc"
                labelProps={{
                  typography: 'CaptionStrong',
                  color: 'text-subdued',
                }}
              />
              <Box flex={1} pr={2}>
                <Slider
                  accessibilityLabel={intl.formatMessage({
                    id: 'form__priority_fee_booster',
                  })}
                  nativeMode={platformEnv.isNative}
                  step={1}
                  value={debouncedPriorityBooster}
                  width="100%"
                  minValue={1}
                  maxValue={100}
                  onChange={handleBoosterOnChange}
                >
                  <Slider.Track bg="surface-neutral-default" height="4px">
                    <Slider.FilledTrack bg="interactive-default" height="4px" />
                  </Slider.Track>
                  <Tooltip
                    label={`${priorityBooster}x`}
                    placement="top"
                    hasArrow
                  >
                    <Slider.Thumb
                      style={{ position: 'absolute' }}
                      borderWidth={0}
                      bg="transparent"
                    >
                      <Box
                        borderRadius="full"
                        borderColor="icon-default"
                        width="16px"
                        height="16px"
                        borderWidth="3px"
                        bg="surface-neutral-default"
                      />
                    </Slider.Thumb>
                  </Tooltip>
                </Slider>
              </Box>
            </HStack>
          </>
        )}

        {!isEIP1559Fee && (
          <Form.Item
            label={`${intl.formatMessage({
              id: 'content__gas_price',
            })} (${feeSymbol})`}
            control={control}
            name="gasPrice"
            rules={{
              validate: async (value) => {
                const lowValue = firstPresetFeeInfo as string;
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
                  setGasPriceTip(null);
                } catch (error) {
                  printError(error);
                  const e = error as OneKeyError;
                  if (
                    e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                  ) {
                    setGasPriceTip({
                      type: 'error',
                      message: intl.formatMessage(
                        {
                          id: e.key as any,
                        },
                        e.info,
                      ),
                    });
                    return false;
                  }
                  if (
                    e?.className === OneKeyErrorClassNames.OneKeyValidatorTip
                  ) {
                    setGasPriceTip({
                      type: 'warn',
                      message: intl.formatMessage(
                        {
                          id: e.key as any,
                        },
                        e.info,
                      ),
                    });
                  }
                }
                return true;
              },
            }}
            defaultValue=""
          >
            <Form.NumberInput size={isSmallScreen ? 'xl' : 'lg'} />
          </Form.Item>
        )}

        <Form.Item
          label={
            <LabelWithTooltip
              labelId="content__gas_limit"
              tooltipId="content__custom_gas_gas_limit_desc"
            />
          }
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
                setGasLimitTip(null);
              } catch (error) {
                printError(error);
                const e = error as OneKeyError;

                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  setGasLimitTip({
                    type: 'error',
                    message: intl.formatMessage(
                      {
                        id: e.key as any,
                      },
                      e.info,
                    ),
                  });
                  return false;
                }
                if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                  setGasLimitTip({
                    type: 'warn',
                    message: intl.formatMessage(
                      {
                        id: e.key as any,
                      },
                      e.info,
                    ),
                  });
                }
              }
              return true;
            },
          }}
          defaultValue=""
        >
          <Form.NumberInput
            size={isSmallScreen ? 'xl' : 'lg'}
            rightCustomElement={
              <Button
                type="plain"
                isDisabled={originLimit === formValues?.gasLimit}
                onPress={() => setValue('gasLimit', originLimit)}
              >
                <Text
                  color={
                    originLimit === formValues?.gasLimit
                      ? 'text-subdued'
                      : 'text-default'
                  }
                >
                  {intl.formatMessage({ id: 'action__reset' })}
                </Text>
              </Button>
            }
          />
        </Form.Item>
      </Form>
    );
  }, [
    formValues?.maxFeePerGas,
    formValues?.gasLimit,
    formValues?.maxPriorityFeePerGas,
    feeInfoPayload?.info.feeDecimals,
    feeInfoPayload?.info?.limit,
    isBtcForkChain,
    isSolChain,
    isEIP1559Fee,
    feeSymbol,
    control,
    nativeSymbol,
    isSmallScreen,
    intl,
    debouncedPriorityBooster,
    handleBoosterOnChange,
    priorityBooster,
    originLimit,
    feeRateFormValidator,
    firstPresetFeeInfo,
    lastPresetFeeInfo,
    networkId,
    getValues,
    autoConfirmAfterFeeSaved,
    selectedFeeInfo?.custom?.price1559,
    selectedFeeInfo?.custom?.price,
    setValue,
  ]);

  const customAlert = useMemo(
    () => (
      <>
        {[maxFeeTip, maxPriorityFeeTip, gasPriceTip, gasLimitTip].map((tip) =>
          tip ? (
            <Box mb={2} key={tip.message}>
              <Alert title={tip.message} alertType={tip.type} dismiss={false} />
            </Box>
          ) : null,
        )}
      </>
    ),
    [gasLimitTip, gasPriceTip, maxFeeTip, maxPriorityFeeTip],
  );

  useEffect(() => {
    // eslint-disable-next-line prefer-const
    let timer: ReturnType<typeof setInterval>;
    const fetchBlockNativeGasInfo = async () => {
      try {
        const resp = await getBlockNativeGasInfo({
          networkId,
          priceOrder: 'desc',
        });
        setBlockNativeFeeInfo(resp);
        setBlockNativeInit(true);

        setLastPresetFeeInfo(first(resp.prices));
        setFirstPresetFeeInfo(last(resp.prices));

        setBasePriority(first(resp.prices)?.maxPriorityFeePerGas ?? '0');
      } catch (e) {
        if (e instanceof NotImplemented) {
          clearInterval(timer);
        }
      }
    };
    fetchBlockNativeGasInfo();
    timer = setInterval(fetchBlockNativeGasInfo, FEE_INFO_POLLING_INTERVAL);
    return () => {
      clearInterval(timer);
    };
  }, [networkId, setBasePriority, setBlockNativeInit]);

  useEffect(() => {
    formTrigger('maxFeePerGas');
  }, [formTrigger, formValues?.maxPriorityFeePerGas]);

  useEffect(() => {
    formTrigger('maxPriorityFeePerGas');
  }, [formTrigger, formValues?.maxFeePerGas]);

  return isSmallScreen || !blockNativeInit ? (
    <>
      {customAlert}
      {customFeeOverview}
      {customConfidence}
      {customForm}
      {blockNativeInit && (
        <BlockNativeFeeInfoPanel
          mt={6}
          networkId={networkId}
          useFormReturn={useFormReturn}
          feeInfo={blockNativeFeeInfo}
          feeSymbol={feeSymbol}
          setPriorityBooster={setPriorityBooster}
        />
      )}
      <Box alignItems="center" mt={12}>
        <CheckBox
          onChange={(isSelected) => setSaveCustom(isSelected)}
          isChecked={saveCustom}
        >
          <Text typography="Body2Strong">
            {intl.formatMessage({
              id: 'action__save_as_default_for_custom',
            })}
          </Text>
        </CheckBox>
      </Box>
    </>
  ) : (
    <HStack space={6} alignContent="flex-start">
      <Box flex={1}>
        {customAlert}
        {customFeeOverview}
        {customConfidence}
        {customForm}
      </Box>
      <Box flex={1}>
        {blockNativeInit && (
          <BlockNativeFeeInfoPanel
            networkId={networkId}
            useFormReturn={useFormReturn}
            feeInfo={blockNativeFeeInfo}
            feeSymbol={feeSymbol}
            setPriorityBooster={setPriorityBooster}
          />
        )}
      </Box>
    </HStack>
  );
}
