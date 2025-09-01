import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import {
  Accordion,
  Alert,
  Divider,
  Icon,
  IconButton,
  Image,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';
import type {
  ICheckAmountAlert,
  IEarnEstimateFeeResp,
  IEarnText,
  IEarnTextTooltip,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { CalculationListItem } from '../CalculationList';
import { EstimateNetworkFee } from '../EstimateNetworkFee';
import { EarnText } from '../ProtocolDetails/EarnText';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../StakingAmountInput';
import StakingFormWrapper from '../StakingFormWrapper';

import type { FontSizeTokens } from 'tamagui';

type IUniversalWithdrawProps = {
  accountAddress: string;
  balance: string;
  price: string;

  accountId?: string;
  networkId?: string;

  providerLogo?: string;
  providerName?: string;

  decimals?: number;

  initialAmount?: string;
  tokenImageUri?: string;
  tokenSymbol?: string;

  minAmount?: string;

  estimateFeeResp?: IEarnEstimateFeeResp;

  protocolVault?: string;

  onConfirm?: ({
    amount,
    withdrawAll,
  }: {
    amount: string;
    withdrawAll: boolean;
  }) => Promise<void>;
};

const isNaN = (num: string) =>
  BigNumber(num).isNaN() || (typeof num === 'string' && num.endsWith('.'));

const WITHDRAW_ACCORDION_KEY = 'withdraw-accordion-content';

export function UniversalWithdraw({
  accountAddress,
  balance,
  price: inputPrice,
  accountId,
  networkId,
  tokenImageUri,
  tokenSymbol,
  providerLogo,
  providerName,
  initialAmount,
  minAmount = '0',
  decimals,
  protocolVault,
  estimateFeeResp,

  onConfirm,
}: PropsWithChildren<IUniversalWithdrawProps>) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { handleOpenWebSite } = useBrowserAction().current;
  const isMorphoProvider = useMemo(
    () => (providerName ? earnUtils.isMorphoProvider({ providerName }) : false),
    [providerName],
  );
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const withdrawAllRef = useRef(false);
  const [amountValue, setAmountValue] = useState(initialAmount ?? '');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const intl = useIntl();

  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  ).result;

  const onPress = useCallback(async () => {
    try {
      setLoading(true);
      await onConfirm?.({
        amount: amountValue,
        withdrawAll: withdrawAllRef.current,
      });
    } finally {
      setLoading(false);
    }
  }, [amountValue, onConfirm]);

  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);
  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  const checkAmount = useDebouncedCallback(async (amount: string) => {
    if (isNaN(amount)) {
      return;
    }
    setCheckAmountLoading(true);
    try {
      const response = await backgroundApiProxy.serviceStaking.checkAmount({
        accountId,
        networkId,
        symbol: tokenSymbol,
        provider: providerName,
        action: ECheckAmountActionType.UNSTAKING,
        amount,
        protocolVault,
        withdrawAll: withdrawAllRef.current,
      });

      if (Number(response.code) === 0) {
        setCheckoutAmountMessage('');
        setCheckAmountAlerts(response.data?.alerts || []);
      } else {
        setCheckoutAmountMessage(response.message);
        setCheckAmountAlerts([]);
      }
    } finally {
      setCheckAmountLoading(false);
    }
  }, 300);

  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IStakeTransactionConfirmation | undefined
  >();
  const fetchTransactionConfirmation = useCallback(
    async (amount: string) => {
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId: networkId || '',
          provider: providerName || '',
          symbol: tokenSymbol || '',
          vault: isMorphoProvider ? protocolVault || '' : '',
          accountAddress,
          action: ECheckAmountActionType.UNSTAKING,
          amount,
        });
      return resp;
    },
    [
      accountAddress,
      isMorphoProvider,
      protocolVault,
      networkId,
      providerName,
      tokenSymbol,
    ],
  );

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (amount?: string) => {
      const resp = await fetchTransactionConfirmation(amount || '0');
      setTransactionConfirmation(resp);
    },
    350,
  );

  useEffect(() => {
    void debouncedFetchTransactionConfirmation(amountValue);
  }, [amountValue, debouncedFetchTransactionConfirmation]);

  const onChangeAmountValue = useCallback(
    (value: string, isMax = false) => {
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setCheckoutAmountMessage('');
          setCheckAmountAlerts([]);
          setAmountValue('');
        }
        return;
      }
      const isOverflowDecimals = Boolean(
        decimals &&
          Number(decimals) > 0 &&
          countDecimalPlaces(value) > decimals,
      );
      if (isOverflowDecimals) {
        setAmountValue((oldValue) => oldValue);
      } else {
        setAmountValue(value);
      }
      withdrawAllRef.current = !!isMax;
      void checkAmount(value);
    },
    [checkAmount, decimals],
  );

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(price) > 0) {
      return BigNumber(amountValue).multipliedBy(price).toFixed();
    }
    return undefined;
  }, [amountValue, price]);

  const remainingLessThanMinAmountWarning = useMemo<boolean>(() => {
    if (Number(minAmount) > 0) {
      const minAmountBN = new BigNumber(Number(minAmount));
      const amountValueBN = new BigNumber(amountValue);
      const balanceBN = new BigNumber(balance);
      if (minAmountBN.gt(0) && amountValueBN.gt(0) && balanceBN.gte(0)) {
        return (
          amountValueBN.gt(0) &&
          amountValueBN.gte(minAmountBN) &&
          balanceBN.minus(amountValueBN).gt(0) &&
          balanceBN.minus(amountValueBN).lt(minAmountBN)
        );
      }
    }
    return false;
  }, [minAmount, amountValue, balance]);
  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);

  const onMax = useCallback(() => {
    onChangeAmountValue(balance, true);
  }, [onChangeAmountValue, balance]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      onChangeAmountValue(
        calcPercentBalance({
          balance,
          percent,
          decimals,
        }),
      );
    },
    [balance, decimals, onChangeAmountValue],
  );

  const isCheckAmountMessageError =
    amountValue?.length > 0 && !!checkAmountMessage;

  const isDisable = useMemo<boolean>(
    () =>
      isNaN(amountValue) ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isCheckAmountMessageError ||
      checkAmountAlerts.length > 0 ||
      checkAmountLoading,
    [
      amountValue,
      isCheckAmountMessageError,
      checkAmountAlerts.length,
      checkAmountLoading,
    ],
  );

  const editable = initialAmount === undefined;

  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0) {
      return items;
    }
    if (transactionConfirmation?.receive) {
      items.push(
        <CalculationListItem>
          <CalculationListItem.Label
            size={transactionConfirmation.receive.title.size || '$bodyMd'}
            color={transactionConfirmation.receive.title.color}
            tooltip={
              transactionConfirmation.receive.tooltip.type === 'text'
                ? transactionConfirmation.receive.tooltip.data.title.text
                : undefined
            }
          >
            {transactionConfirmation.receive.title.text}
          </CalculationListItem.Label>
          <EarnText
            text={transactionConfirmation.receive.description}
            size="$bodyMdMedium"
          />
        </CalculationListItem>,
      );
    }
    if (estimateFeeResp) {
      items.push(
        <EstimateNetworkFee
          estimateFeeResp={estimateFeeResp}
          isVisible={Number(amountValue) > 0}
        />,
      );
    }
    return items;
  }, [amountValue, estimateFeeResp, transactionConfirmation?.receive]);
  const isAccordionTriggerDisabled = !amountValue;

  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={editable ? 1 : 0.7}>
        <StakingAmountInput
          title={intl.formatMessage({ id: ETranslations.global_withdraw })}
          disabled={!editable}
          hasError={isCheckAmountMessageError}
          value={amountValue}
          onChange={onChangeAmountValue}
          onBlur={onBlurAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol,
            selectedNetworkImageUri: network?.logoURI,
          }}
          inputProps={{
            placeholder: '0',
            autoFocus: editable,
          }}
          balanceProps={{
            value: balance,
            iconText: intl.formatMessage({ id: ETranslations.global_withdraw }),
            onPress: onMax,
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
          enableMaxAmount
          onSelectPercentageStage={onSelectPercentageStage}
        />
        {!editable ? (
          <Stack position="absolute" w="100%" h="100%" zIndex={1} />
        ) : null}
      </Stack>

      {remainingLessThanMinAmountWarning ? (
        <Alert
          icon="InfoCircleOutline"
          type="warning"
          title={intl.formatMessage(
            { id: ETranslations.earn_unstake_all_due_to_min_withdrawal },
            { number: minAmount, symbol: tokenSymbol },
          )}
        />
      ) : null}
      {isCheckAmountMessageError ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={checkAmountMessage}
        />
      ) : null}
      {checkAmountAlerts.length > 0 ? (
        <>
          {checkAmountAlerts.map((alert, index) => (
            <Alert
              key={index}
              type="warning"
              renderTitle={() => {
                return <EarnText text={alert.text} size="$bodyMdMedium" />;
              }}
              action={
                alert.button
                  ? {
                      primary: alert.button.text.text,
                      onPrimaryPress: () => {
                        if (alert.button?.data?.link) {
                          handleOpenWebSite({
                            switchToMultiTabBrowser: gtMd,
                            navigation,
                            useCurrentWindow: false,
                            webSite: {
                              url: alert.button.data.link,
                              title: alert.button.data.link,
                              logo: undefined,
                              sortIndex: undefined,
                            },
                          });
                        }
                      },
                    }
                  : undefined
              }
            />
          ))}
        </>
      ) : null}
      <YStack
        p="$3.5"
        pt="$5"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        <YStack gap="$2">
          <XStack ai="center" gap="$1">
            <EarnText
              text={transactionConfirmation?.title}
              color="$textSubdued"
              size="$bodyMd"
            />
            {transactionConfirmation?.tooltip ? (
              <Popover
                placement="top"
                title={transactionConfirmation?.title?.text}
                renderTrigger={
                  <IconButton
                    iconColor="$iconSubdued"
                    size="small"
                    icon="InfoCircleOutline"
                    variant="tertiary"
                  />
                }
                renderContent={
                  <Stack p="$5">
                    <EarnText
                      text={
                        transactionConfirmation?.tooltip?.type === 'text'
                          ? transactionConfirmation.tooltip.data
                          : undefined
                      }
                      size="$bodyMd"
                    />
                  </Stack>
                }
              />
            ) : null}
          </XStack>
          {transactionConfirmation?.rewards.map((reward) => {
            const hasTooltip = reward.tooltip?.type === 'text';
            let descriptionTextSize = (
              hasTooltip ? '$bodyMd' : '$bodyLgMedium'
            ) as FontSizeTokens;
            if (reward.description.size) {
              descriptionTextSize = reward.description.size;
            }
            return (
              <XStack
                key={reward.title.text}
                gap="$1"
                ai="flex-start"
                mt="$1.5"
                flexWrap="wrap"
              >
                <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                  <EarnText
                    text={reward.title}
                    color={reward.title.color}
                    size={reward.title.size}
                  />
                  <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                    <EarnText
                      text={reward.description}
                      size={descriptionTextSize}
                      color={reward.description.color ?? '$textSubdued'}
                      flexShrink={1}
                    />
                    {hasTooltip ? (
                      <Popover.Tooltip
                        iconSize="$5"
                        title={reward.title.text}
                        tooltip={
                          (reward.tooltip as IEarnTextTooltip)?.data.text
                        }
                        placement="top"
                      />
                    ) : null}
                  </XStack>
                </XStack>
              </XStack>
            );
          })}
        </YStack>
        <Divider my="$5" />
        <Accordion
          overflow="hidden"
          width="100%"
          type="single"
          collapsible
          defaultValue={WITHDRAW_ACCORDION_KEY}
        >
          <Accordion.Item value={WITHDRAW_ACCORDION_KEY}>
            <Accordion.Trigger
              unstyled
              flexDirection="row"
              alignItems="center"
              alignSelf="flex-start"
              px="$1"
              mx="$-1"
              width="100%"
              justifyContent="space-between"
              borderWidth={0}
              bg="$transparent"
              userSelect="none"
              borderRadius="$1"
              cursor={isAccordionTriggerDisabled ? 'not-allowed' : 'pointer'}
              disabled={isAccordionTriggerDisabled}
            >
              {({ open }: { open: boolean }) => (
                <>
                  <XStack gap="$1.5" alignItems="center">
                    <Image
                      width="$5"
                      height="$5"
                      src={providerLogo}
                      borderRadius="$2"
                    />
                    <SizableText size="$bodyMd">
                      {capitalizeString(providerName || '')}
                    </SizableText>
                  </XStack>
                  <XStack>
                    {isAccordionTriggerDisabled ? undefined : (
                      <SizableText color="$textSubdued" size="$bodyMd">
                        {intl.formatMessage({
                          id: ETranslations.global_details,
                        })}
                      </SizableText>
                    )}
                    <YStack
                      animation="quick"
                      rotate={
                        open && !isAccordionTriggerDisabled ? '180deg' : '0deg'
                      }
                      left="$2"
                    >
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={
                          isAccordionTriggerDisabled
                            ? '$iconDisabled'
                            : '$iconSubdued'
                        }
                        size="$5"
                      />
                    </YStack>
                  </XStack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick">
              <Accordion.Content
                animation="quick"
                exitStyle={{ opacity: 0 }}
                px={0}
                pb={0}
                pt="$3.5"
                gap="$2.5"
              >
                {accordionContent}
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      </YStack>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_withdraw,
        })}
        confirmButtonProps={{
          onPress,
          loading: loading || checkAmountLoading,
          disabled: isDisable,
        }}
      />

      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_withdraw,
          })}
          confirmButtonProps={{
            onPress,
            loading,
            disabled: isDisable,
          }}
        />
        <PercentageStageOnKeyboard
          onSelectPercentageStage={onSelectPercentageStage}
        />
      </Page.Footer>
    </StakingFormWrapper>
  );
}
