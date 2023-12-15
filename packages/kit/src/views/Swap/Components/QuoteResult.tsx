import { Icon, Image, Text, XStack, YStack } from '@onekeyhq/components';

import type { IFetchQuoteResponse } from '../types';

interface IQuoteResultProps {
  quoteResponse: IFetchQuoteResponse;
  onSelectQuote: (quote: IFetchQuoteResponse) => void;
}

export const QuoteResult = ({
  quoteResponse,
  onSelectQuote,
}: IQuoteResultProps) => {
  const { quoteResult, limit } = quoteResponse;
  return (
    <YStack
      space="$1"
      onPress={() => {
        onSelectQuote(quoteResponse);
      }}
    >
      <XStack space="$4">
        <Image
          source={{ uri: quoteResult.info.providerLogo }}
          style={{ width: 20, height: 20 }}
        />
        <Text variant="$headingXl">Info</Text>
      </XStack>
      <XStack space="$4">
        <Text>Provider</Text>
        <Text>{quoteResult.info.provider}</Text>
      </XStack>
      <Text variant="$headingXl">Fee</Text>
      <XStack space="$4">
        <Text>NetworkFees</Text>
        <YStack>
          {quoteResult.fee.netWorkFees?.map((fee) => {
            if (fee.gas) {
              return (
                <XStack space="$4">
                  <Text>gas 需要和gasprice 计算才得预估网络费</Text>
                  <Text>{fee.gas}</Text>
                </XStack>
              );
            }
            if (fee.value) {
              return (
                <>
                  <XStack space="$4">
                    <Text>asset</Text>
                    <Text>{fee.value.asset?.symbol ?? ''}</Text>
                    <Text>{fee.value.asset?.networkId ?? ''}</Text>
                    <Text>{fee.value.asset?.address ?? ''}</Text>
                  </XStack>
                  <XStack space="$4">
                    <Text>amount</Text>
                    <Text>{fee.value.amount ?? ''}</Text>
                  </XStack>
                </>
              );
            }
            return null;
          })}
        </YStack>
      </XStack>
      <XStack>
        <Text>ProtocolFees</Text>
        <YStack>
          {quoteResult.fee.protocolFees?.map((fee) => (
            <>
              <XStack space="$4">
                <Text>asset</Text>
                <Text>{fee.asset?.symbol ?? ''}</Text>
                <Text>{fee.asset?.networkId ?? ''}</Text>
                <Text>{fee.asset?.address ?? ''}</Text>
              </XStack>
              <XStack space="$4">
                <Text>amount</Text>
                <Text>{fee.amount ?? ''}</Text>
              </XStack>
            </>
          ))}
        </YStack>
      </XStack>
      <XStack space="$4">
        <Text>toAmount</Text>
        <Text>{quoteResult.toAmount}</Text>
      </XStack>
      <XStack space="$4">
        <Text>
          finialAmount 计算扣除协议费和 onekey 费后的预估得到，没有计算网络费
        </Text>
        <Text>{quoteResult.finialAmount}</Text>
      </XStack>
      <XStack space="$4">
        <Text>allowanceTarget 授权地址</Text>
        <Text>{quoteResult.allowanceTarget}</Text>
      </XStack>
    </YStack>
  );
};
