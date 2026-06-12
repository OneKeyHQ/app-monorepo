import { memo, useMemo } from 'react';

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
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  privateSendProvider,
  swapSlippageDecimal,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  type ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

interface IProps {
  data: ISwapTxInfo;
}

const textStyle: ISizableTextProps = {
  size: '$bodyMd',
};

const FROM_TOKEN_RATE_BASE_NUMBER = 1;

function SwapInfo(props: IProps) {
  const { data } = props;
  const { sender, receiver, swapBuildResData, swapRequiredApproves } = data;
  const {
    info: provider,
    instantRate,
    slippage,
    unSupportSlippage,
  } = swapBuildResData.result;
  const isPrivateSend =
    data.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    provider.provider === privateSendProvider;

  const { network: senderNetwork } = useAccountData({
    networkId: sender.accountInfo.networkId,
  });

  const { network: _receiverNetwork } = useAccountData({
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

  const intl = useIntl();

  if (!data) {
    return null;
  }

  return (
    <>
      <XStack m="$-2.5" flexWrap="wrap" testID="swap-info">
        <SignatureConfirmItem compact p="$2.5">
          <SignatureConfirmItem.Label>
            {intl.formatMessage({
              id: ETranslations.swap_history_detail_provider,
            })}
          </SignatureConfirmItem.Label>
          <XStack alignItems="center" gap="$2" flex={1}>
            <Image
              borderRadius="$1"
              w="$5"
              h="$5"
              source={{ uri: provider.providerLogo }}
            />
            <SizableText flex={1} flexWrap="wrap" {...textStyle}>
              {provider.providerName}
            </SizableText>
          </XStack>
        </SignatureConfirmItem>

        {tokenRate && !isPrivateSend ? (
          <SignatureConfirmItem compact p="$2.5">
            <SignatureConfirmItem.Label>
              {intl.formatMessage({
                id: ETranslations.swap_history_detail_rate,
              })}
            </SignatureConfirmItem.Label>
            {tokenRate}
          </SignatureConfirmItem>
        ) : null}

        {unSupportSlippage || isPrivateSend ? null : (
          <SignatureConfirmItem compact p="$2.5">
            <SignatureConfirmItem.Label>
              {intl.formatMessage({
                id: ETranslations.swap_page_provider_slippage_tolerance,
              })}
            </SignatureConfirmItem.Label>
            <SignatureConfirmItem.Value>
              {displaySlippage}%
            </SignatureConfirmItem.Value>
          </SignatureConfirmItem>
        )}
      </XStack>
      <Divider />
      <Stack>
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
    </>
  );
}

export default memo(SwapInfo);
