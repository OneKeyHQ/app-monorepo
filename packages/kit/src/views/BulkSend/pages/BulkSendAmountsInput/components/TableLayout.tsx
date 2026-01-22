import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

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
  const { tokenInfo, transfersInfo, amountInputMode, amountInputValues } =
    useBulkSendAmountsInputContext();

  const { primaryText, secondaryText } = useMemo(() => {
    const tokenSymbol = tokenInfo.symbol;

    switch (amountInputMode) {
      case EAmountInputMode.Specified: {
        const specifiedAmount = amountInputValues.specifiedAmount || '0';
        const total = new BigNumber(specifiedAmount)
          .times(transfersInfo.length)
          .toFixed();
        return {
          primaryText: `${specifiedAmount} ${tokenSymbol}`,
          secondaryText: `Total: ${total} ${tokenSymbol}`,
        };
      }
      case EAmountInputMode.Range: {
        const min = amountInputValues.rangeMin || '0';
        const max = amountInputValues.rangeMax || '0';
        return {
          primaryText: `${min} ${tokenSymbol} ~ ${max} ${tokenSymbol}`,
          secondaryText: undefined,
        };
      }
      case EAmountInputMode.Custom:
        return {
          primaryText: 'Custom',
          secondaryText: 'Set for each accounts',
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
    transfersInfo.length,
    tokenInfo.symbol,
  ]);

  return (
    <YStack gap="$1.5" flex={1}>
      <SizableText size="$bodyMdMedium">Set amount per address</SizableText>
      <ListItem mx="$0" px="$0" drillIn>
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
        <Stack flex={1} minWidth={0}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            FROM
          </SizableText>
        </Stack>
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
