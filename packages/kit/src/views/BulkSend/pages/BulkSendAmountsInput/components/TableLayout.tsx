import { useCallback, useMemo } from 'react';

import {
  IconButton,
  Input,
  SizableText,
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
import { generateAmountsFromSpecifiedAmount, generateRandomAmountsFromRange } from '../../../utils';

function AssetSection() {
  const { networkId, tokenInfo, tokenDetails } =
    useBulkSendAmountsInputContext();
  const { network } = useAccountData({ networkId });

  return (
    <YStack gap="$1.5" flex={1}>
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

  const { primaryText, secondaryText } = useMemo(() => {
    const tokenSymbol = tokenInfo.symbol;

    const secondaryText = `Total: ${totalTokenAmount} ${tokenSymbol} (${totalFiatAmount}${settings.currencyInfo.symbol})`;

    switch (amountInputMode) {
      case EAmountInputMode.Specified: {
        const specifiedAmount = amountInputValues.specifiedAmount || '0';
        return {
          primaryText: `${specifiedAmount} ${tokenSymbol}`,
          secondaryText,
        };
      }
      case EAmountInputMode.Range: {
        const min = amountInputValues.rangeMin || '0';
        const max = amountInputValues.rangeMax || '0';
        return {
          primaryText: `${min} ${tokenSymbol} ~ ${max} ${tokenSymbol}`,
          secondaryText,
        };
      }
      case EAmountInputMode.Custom:
        return {
          primaryText: 'Custom',
          secondaryText,
        };
      default:
        return {
          primaryText: `0 ${tokenSymbol}`,
          secondaryText: undefined,
        };
    }
  }, [
    amountInputMode,
    amountInputValues,
    totalTokenAmount,
    totalFiatAmount,
    settings.currencyInfo.symbol,
    tokenInfo.symbol,
  ]);

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

  return (
    <YStack gap="$1.5" flex={1}>
      <SizableText size="$bodyMdMedium">Set amount per address</SizableText>
      <ListItem mx="$-3" drillIn onPress={handlePress}>
        <ListItem.Text
          flex={1}
          primary={primaryText}
          secondary={secondaryText}
        />
      </ListItem>
    </YStack>
  );
}

function TransferInfoListSection() {
  const { transfersInfo, setTransfersInfo, amountInputMode } =
    useBulkSendAmountsInputContext();

  const handleDelete = useCallback(
    (index: number) => {
      const newTransfersInfo = [...transfersInfo];
      newTransfersInfo.splice(index, 1);
      setTransfersInfo(newTransfersInfo);
    },
    [transfersInfo, setTransfersInfo],
  );

  const handleAmountChange = useCallback(
    (index: number, value: string) => {
      const newTransfersInfo = [...transfersInfo];
      newTransfersInfo[index] = {
        ...newTransfersInfo[index],
        amount: value,
      };
      setTransfersInfo(newTransfersInfo);
    },
    [transfersInfo, setTransfersInfo],
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
        <Stack width={80}>
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
      {transfersInfo.map((transfer, index) => (
        <XStack
          key={`${transfer.from}-${transfer.to}-${index}`}
          px="$5"
          py="$2"
          gap="$3"
          alignItems="flex-start"
          minHeight={48}
        >
          {/* FROM */}
          <XStack flex={1} minWidth={0} gap="$1">
            <SizableText size="$bodyMdMedium" color="$textDisabled">
              {index + 1}.
            </SizableText>
            <SizableText size="$bodyMdMedium" flex={1} minWidth={0}>
              {transfer.from}
            </SizableText>
          </XStack>

          {/* TO */}
          <Stack flex={1} minWidth={0}>
            <SizableText size="$bodyMdMedium">{transfer.to}</SizableText>
          </Stack>

          {/* AMOUNT */}
          <Stack width={80} alignItems="flex-end">
            {isCustomMode ? (
              <Input
                value={transfer.amount}
                onChangeText={(value) => handleAmountChange(index, value)}
                placeholder="0"
                keyboardType="decimal-pad"
                textAlign="right"
                size="small"
                borderWidth={0}
                backgroundColor="transparent"
                px="$0"
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
      ))}
    </YStack>
  );
}

function TableLayout() {
  return (
    <YStack gap="$8">
      <XStack gap="$6">
        <AssetSection />
        <SetAmountPerAddressSection />
      </XStack>
      <TransferInfoListSection />
    </YStack>
  );
}

export default TableLayout;
