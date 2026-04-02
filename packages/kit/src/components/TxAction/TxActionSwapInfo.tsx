import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { ISizableTextProps } from '@onekeyhq/components';
import {
  Divider,
  Image,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  swapServiceFeeDefault,
  swapSlippageDecimal,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';

import { useAccountData } from '../../hooks/useAccountData';
import {
  InfoItem,
  InfoItemGroup,
} from '../../views/AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import { SwapServiceFeeOverview } from '../../views/Swap/components/SwapServiceFeeOverview';
import { NetworkAvatar } from '../NetworkAvatar';

interface IProps {
  swapInfo: ISwapTxInfo;
}

const textStyle: ISizableTextProps = {
  size: '$bodyMd',
};

const FROM_TOKEN_RATE_BASE_NUMBER = 1;

function TxActionSwapInfo(props: IProps) {
  const { swapInfo } = props;
  const { sender, receiver, swapBuildResData, swapRequiredApproves } = swapInfo;
  const {
    info: provider,
    instantRate,
    slippage,
    unSupportSlippage,
    fee,
  } = swapBuildResData.result;

  const { network: senderNetwork } = useAccountData({
    networkId: sender.accountInfo.networkId,
  });

  const { network: receiverNetwork } = useAccountData({
    networkId: receiver.accountInfo.networkId,
  });

  const displaySlippage = useMemo(
    () =>
      new BigNumber(slippage ?? 0)
        .decimalPlaces(swapSlippageDecimal, BigNumber.ROUND_DOWN)
        .toFixed(),
    [slippage],
  );

  const tokenRate = useMemo(() => {
    if (isNil(instantRate)) {
      return null;
    }

    const senderTokenSymbol = sender.token.symbol;
    const receiverTokenSymbol = receiver.token.symbol;

    return (
      <XStack alignItems="center" gap="$1">
        <NumberSizeableText
          formatter="balance"
          formatterOptions={{
            tokenSymbol: senderTokenSymbol,
          }}
          {...textStyle}
        >
          {FROM_TOKEN_RATE_BASE_NUMBER}
        </NumberSizeableText>
        <SizableText {...textStyle}>=</SizableText>
        <NumberSizeableText
          formatter="balance"
          formatterOptions={{
            tokenSymbol: receiverTokenSymbol,
          }}
          {...textStyle}
        >
          {instantRate}
        </NumberSizeableText>
      </XStack>
    );
  }, [instantRate, receiver.token.symbol, sender.token.symbol]);

  const serviceFee = useMemo(() => {
    if (!fee || isNil(fee.percentageFee)) {
      return null;
    }

    if (new BigNumber(fee.percentageFee).gte(swapServiceFeeDefault)) {
      return (
        <XStack alignItems="center" gap="$1">
          <SizableText {...textStyle}>{fee.percentageFee}%</SizableText>
          <SwapServiceFeeOverview onekeyFee={fee.percentageFee} />
        </XStack>
      );
    }

    return (
      <XStack alignItems="center" gap="$1">
        <SizableText color="$textSuccess" {...textStyle}>
          {fee.percentageFee}%
        </SizableText>
        <SizableText textDecorationLine="line-through" {...textStyle}>
          {swapServiceFeeDefault}%
        </SizableText>
        <SwapServiceFeeOverview onekeyFee={fee.percentageFee} />
      </XStack>
    );
  }, [fee]);

  const intl = useIntl();

  if (!swapInfo) {
    return null;
  }

  return (
    <Stack>
      <InfoItemGroup testID="swap-tx-action">
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.swap_history_detail_provider,
          })}
          renderContent={
            <XStack alignItems="center" gap="$2">
              <Image
                borderRadius="$1"
                w="$5"
                h="$5"
                source={{ uri: provider.providerLogo }}
              />
              <SizableText {...textStyle}>{provider.providerName}</SizableText>
            </XStack>
          }
          compactAll
        />
        {tokenRate ? (
          <InfoItem
            label={intl.formatMessage({
              id: ETranslations.swap_history_detail_rate,
            })}
            renderContent={tokenRate}
            compactAll
          />
        ) : null}

        {unSupportSlippage ? null : (
          <InfoItem
            label={intl.formatMessage({
              id: ETranslations.swap_page_provider_slippage_tolerance,
            })}
            renderContent={
              <SizableText {...textStyle}>{displaySlippage}%</SizableText>
            }
            compactAll
          />
        )}
        {serviceFee ? (
          <InfoItem
            label={intl.formatMessage({
              id: ETranslations.swap_history_detail_service_fee,
            })}
            renderContent={serviceFee}
            compactAll
          />
        ) : null}
        {sender.accountInfo.networkId !== receiver.accountInfo.networkId ? (
          <InfoItem
            compactAll
            label={intl.formatMessage({ id: ETranslations.network__network })}
            renderContent={
              <XStack alignItems="center" gap="$2">
                <XStack alignItems="center">
                  <NetworkAvatar
                    networkId={sender.accountInfo.networkId}
                    size="$5"
                  />

                  <Stack
                    p="$0.5"
                    m="$-0.5"
                    ml="$-1"
                    borderRadius="$full"
                    bg="$bgApp"
                  >
                    <NetworkAvatar
                      networkId={receiver.accountInfo.networkId}
                      size="$5"
                    />
                  </Stack>
                </XStack>
                <SizableText size="$bodyMd" color="$text">
                  {senderNetwork?.name} → {receiverNetwork?.name}
                </SizableText>
              </XStack>
            }
          />
        ) : (
          <InfoItem
            compactAll
            label={intl.formatMessage({ id: ETranslations.network__network })}
            renderContent={
              <XStack alignItems="center" gap="$2">
                <NetworkAvatar
                  networkId={sender.accountInfo.networkId}
                  size="$5"
                />
                <SizableText {...textStyle} color="$text">
                  {senderNetwork?.name}
                </SizableText>
              </XStack>
            }
          />
        )}
      </InfoItemGroup>
      <Divider mx="$5" />
      <Stack p="$5">
        <SizableText size="$bodySm" color="$textSubdued">
          {swapRequiredApproves
            ? intl.formatMessage(
                {
                  id: ETranslations.transaction_confirm_batch_swap_tip,
                },
                {
                  token: sender.token.symbol,
                  chain: senderNetwork?.name,
                  provider: provider.providerName,
                },
              )
            : intl.formatMessage(
                {
                  id: ETranslations.transaction_confirm_single_swap_tip,
                },
                {
                  chain: senderNetwork?.name,
                  provider: provider.providerName,
                },
              )}
        </SizableText>
      </Stack>
    </Stack>
  );
}

export { TxActionSwapInfo };
