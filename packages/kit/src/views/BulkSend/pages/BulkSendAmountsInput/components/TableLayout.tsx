import { useCallback, useMemo } from 'react';

import {
  Icon,
  IconButton,
  Input,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { EAmountInputMode } from '@onekeyhq/shared/types/bulkSend';

import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { useBulkSendAmountsInputContext } from './Context';
import { showSetAmountPerAddressDialog } from './SetAmountPerAddressDialog';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  generateAmountsFromSpecifiedAmount,
  generateRandomAmountsFromRange,
} from '../../../utils';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';

function AssetSection() {
  const { networkId, tokenInfo, tokenDetails } =
    useBulkSendAmountsInputContext();
  const { network } = useAccountData({ networkId });

  return (
    <YStack gap="$1.5" flex={1} flexBasis={0} minWidth={0}>
      <SizableText size="$bodyMdMedium">Asset</SizableText>
      <ListItem
        mx="$0"
        px="$0"
        renderAvatar={() => (
          <Token
            tokenImageUri={tokenDetails?.info.logoURI}
            size="md"
            showNetworkIcon
            networkImageUri={network?.logoURI}
            networkId={network?.id}
          />
        )}
        title={tokenInfo.symbol}
        subtitle={network?.name}
      />
    </YStack>
  );
}

function SetAmountPerAddressSection() {
  const {
    accountId,
    networkId,
    tokenInfo,
    tokenDetails,
    tokenDetailsState,
    transfersInfo,
    amountInputMode,
    amountInputValues,
    setAmountInputMode,
    setAmountInputValues,
    totalTokenAmount,
    totalFiatAmount,
    setTransfersInfo,
  } = useBulkSendAmountsInputContext();

  const [settings] = useSettingsPersistAtom();

  const primaryText = useMemo(() => {
    const tokenSymbol = tokenInfo.symbol;

    switch (amountInputMode) {
      case EAmountInputMode.Specified: {
        const specifiedAmount = amountInputValues.specifiedAmount || '0';
        return `${specifiedAmount} ${tokenSymbol}`;
      }
      case EAmountInputMode.Range: {
        const min = amountInputValues.rangeMin || '0';
        const max = amountInputValues.rangeMax || '0';
        return `${min} ${tokenSymbol} ~ ${max} ${tokenSymbol}`;
      }
      case EAmountInputMode.Custom:
        return 'Custom';
      default:
        return `0 ${tokenSymbol}`;
    }
  }, [amountInputMode, amountInputValues, tokenInfo.symbol]);

  const handlePress = useCallback(() => {
    showSetAmountPerAddressDialog({
      accountId,
      networkId,
      tokenInfo,
      tokenDetails,
      transfersInfo,
      initialMode: amountInputMode,
      initialValues: amountInputValues,
      onConfirm: (mode, values) => {
        setAmountInputMode(mode);
        setAmountInputValues(values);
        let newTransfersInfo = [...transfersInfo];

        if (mode === EAmountInputMode.Range) {
          const amounts = generateRandomAmountsFromRange({
            transfersInfo,
            rangeMin: values.rangeMin,
            rangeMax: values.rangeMax,
            decimals: tokenInfo.decimals,
          });
          newTransfersInfo = transfersInfo.map((transfer, index) => ({
            ...transfer,
            amount: amounts[index],
          }));
        } else {
          const amounts = generateAmountsFromSpecifiedAmount({
            specifiedAmount: values.specifiedAmount ?? '0',
            transfersInfo,
          });
          newTransfersInfo = transfersInfo.map((transfer, index) => ({
            ...transfer,
            amount: amounts[index],
          }));
        }
        setTransfersInfo(newTransfersInfo);
      },
    });
  }, [
    accountId,
    networkId,
    tokenInfo,
    tokenDetails,
    transfersInfo,
    amountInputMode,
    amountInputValues,
    setAmountInputMode,
    setAmountInputValues,
    setTransfersInfo,
  ]);

  const renderSecondary = useCallback(() => {
    // Only show loading state when token details haven't been initialized yet
    if (!tokenDetailsState.initialized && tokenDetailsState.isRefreshing) {
      return <Skeleton.BodyMd />;
    }

    return (
      <XStack alignItems="center" gap="$1" flexWrap="wrap">
        <SizableText size="$bodyMd" color="$textSubdued">
          Total:
        </SizableText>
        <NumberSizeableText
          formatter="balance"
          size="$bodyMd"
          color="$textSubdued"
          formatterOptions={{ tokenSymbol: tokenInfo.symbol }}
        >
          {totalTokenAmount}
        </NumberSizeableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          (
        </SizableText>
        <NumberSizeableText
          formatter="value"
          size="$bodyMd"
          color="$textSubdued"
          formatterOptions={{ currency: settings.currencyInfo.symbol }}
        >
          {totalFiatAmount}
        </NumberSizeableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          )
        </SizableText>
      </XStack>
    );
  }, [
    tokenDetailsState.isRefreshing,
    tokenDetailsState.initialized,
    tokenInfo.symbol,
    totalTokenAmount,
    totalFiatAmount,
    settings.currencyInfo.symbol,
  ]);

  return (
    <YStack gap="$1.5" flex={1} flexBasis={0} minWidth={0}>
      <SizableText size="$bodyMdMedium">Set amount per address</SizableText>
      <ListItem mx="$-3" drillIn onPress={handlePress}>
        <ListItem.Text
          flex={1}
          primary={primaryText}
          secondary={renderSecondary()}
        />
      </ListItem>
    </YStack>
  );
}

function TransferInfoListSection() {
  const {
    transfersInfo,
    setTransfersInfo,
    amountInputMode,
    tokenInfo,
    transferInfoErrors,
    setTransferInfoErrors,
  } = useBulkSendAmountsInputContext();

  const handleDelete = useCallback(
    (index: number) => {
      const newTransfersInfo = [...transfersInfo];
      newTransfersInfo.splice(index, 1);
      setTransfersInfo(newTransfersInfo);

      // Remove the error for the deleted index and shift subsequent indices
      const newErrors = { ...transferInfoErrors };
      delete newErrors[index];
      const shiftedErrors: typeof newErrors = {};
      Object.keys(newErrors).forEach((key) => {
        const keyNum = Number(key);
        if (keyNum > index) {
          shiftedErrors[keyNum - 1] = newErrors[keyNum];
        } else {
          shiftedErrors[keyNum] = newErrors[keyNum];
        }
      });
      setTransferInfoErrors(shiftedErrors);
    },
    [
      transfersInfo,
      setTransfersInfo,
      transferInfoErrors,
      setTransferInfoErrors,
    ],
  );

  const handleAmountChange = useCallback(
    (index: number, value: string) => {
      const newTransfersInfo = [...transfersInfo];
      newTransfersInfo[index] = {
        ...newTransfersInfo[index],
        amount: value,
      };
      setTransfersInfo(newTransfersInfo);

      // Validate and update errors
      const { isValid, error } = validateTokenAmount({
        token: tokenInfo,
        amount: value,
      });
      const newErrors = { ...transferInfoErrors };
      if (!isValid && error) {
        newErrors[index] = {
          ...newErrors[index],
          amount: error,
        };
      } else if (newErrors[index]) {
        const { amount: _, ...rest } = newErrors[index];
        if (Object.keys(rest).length === 0) {
          delete newErrors[index];
        } else {
          newErrors[index] = rest;
        }
      }
      setTransferInfoErrors(newErrors);
    },
    [
      transfersInfo,
      setTransfersInfo,
      tokenInfo,
      transferInfoErrors,
      setTransferInfoErrors,
    ],
  );

  const isCustomMode = amountInputMode === EAmountInputMode.Custom;

  if (transfersInfo.length === 0) {
    return null;
  }

  return (
    <YStack
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      py="$2"
    >
      {/* Header */}
      <XStack px="$5" py="$2" gap="$3">
        <XStack flex={1} minWidth={0}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            FROM
          </SizableText>
        </XStack>
        <Stack flex={1} minWidth={0}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            TO
          </SizableText>
        </Stack>
        <Stack width={100}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
            textAlign="right"
          >
            AMOUNT
          </SizableText>
        </Stack>
        <Stack width={64}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
            textAlign="right"
          >
            ACTION
          </SizableText>
        </Stack>
      </XStack>

      {/* List Items */}
      {transfersInfo.map((transfer, index) => {
        const errors = transferInfoErrors[index];
        const hasFromError = !!errors?.from;
        const hasToError = !!errors?.to;
        const hasAmountError = !!errors?.amount;

        return (
          <XStack
            key={`${transfer.from}-${transfer.to}-${index}`}
            px="$5"
            py="$2"
            gap="$3"
            alignItems="flex-start"
            minHeight={48}
          >
            {/* FROM */}
            <YStack flex={1} minWidth={0} gap="$1">
              <XStack gap="$1">
                <SizableText size="$bodyMdMedium" color="$textDisabled">
                  {index + 1}.
                </SizableText>
                <SizableText
                  size="$bodyMdMedium"
                  flex={1}
                  minWidth={0}
                  color={hasFromError ? '$textCritical' : undefined}
                >
                  {transfer.from}
                </SizableText>
              </XStack>
              {hasFromError ? (
                <XStack gap="$1" alignItems="center">
                  <Icon
                    name="InfoCircleOutline"
                    size="$4"
                    color="$iconCritical"
                  />
                  <SizableText size="$bodySm" color="$textCritical">
                    {errors.from}
                  </SizableText>
                </XStack>
              ) : null}
            </YStack>

            {/* TO */}
            <YStack flex={1} minWidth={0} gap="$1">
              <SizableText
                size="$bodyMdMedium"
                color={hasToError ? '$textCritical' : undefined}
              >
                {transfer.to}
              </SizableText>
              {hasToError ? (
                <XStack gap="$1" alignItems="center">
                  <Icon
                    name="InfoCircleOutline"
                    size="$4"
                    color="$iconCritical"
                  />
                  <SizableText size="$bodySm" color="$textCritical">
                    {errors.to}
                  </SizableText>
                </XStack>
              ) : null}
            </YStack>

            {/* AMOUNT */}
            <Stack width={100} alignItems="flex-end">
              {isCustomMode ? (
                <Input
                  value={transfer.amount}
                  onChangeText={(value) => handleAmountChange(index, value)}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  textAlign="right"
                  size="small"
                  error={hasAmountError}
                  leftAddOnProps={
                    hasAmountError
                      ? {
                          iconName: 'ErrorOutline',
                          iconColor: '$iconCritical',
                          tooltipProps: {
                            placement: 'top',
                            renderContent: errors?.amount,
                          },
                        }
                      : undefined
                  }
                  containerProps={{
                    width: '100%',
                    backgroundColor: '$bgSubdued',
                  }}
                />
              ) : (
                <SizableText size="$bodyLgMedium">
                  {transfer.amount || '0'}
                </SizableText>
              )}
            </Stack>

            {/* ACTION */}
            <Stack width={64} alignItems="flex-end">
              <IconButton
                icon="DeleteOutline"
                variant="tertiary"
                size="small"
                disabled={transfersInfo.length === 1}
                onPress={() => handleDelete(index)}
              />
            </Stack>
          </XStack>
        );
      })}
    </YStack>
  );
}

function TableLayout() {
  const { isInsufficientBalance, tokenDetails, totalTokenAmount, tokenInfo } =
    useBulkSendAmountsInputContext();

  return (
    <YStack gap="$8">
      <XStack gap="$6">
        <AssetSection />
        <SetAmountPerAddressSection />
      </XStack>
      <TransferInfoListSection />
      {/* Insufficient Balance Error */}
      {isInsufficientBalance ? (
        <XStack gap="$1" alignItems="center">
          <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
          <SizableText size="$bodySm" color="$textCritical">
            Insufficient balance, available balance:{' '}
            {tokenDetails?.balanceParsed} {tokenInfo.symbol}, total amount:{' '}
            {totalTokenAmount} {tokenInfo.symbol}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}

export default TableLayout;
