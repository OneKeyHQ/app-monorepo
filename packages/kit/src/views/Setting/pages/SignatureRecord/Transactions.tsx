import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Empty,
  IconButton,
  NumberSizeableText,
  SectionList,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import utils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { buildExplorerAddressUrl } from '@onekeyhq/shared/src/utils/uriUtils';
import type {
  IApproveTransactionData,
  ISendTransactionData,
  ISignedTransaction,
  ISwapTransactionData,
} from '@onekeyhq/shared/types/signatureRecord';

import { useGetSignatureSections } from './hooks';

const SendTransactionItem = ({ data }: { data: ISendTransactionData }) => (
  <XStack justifyContent="space-between" w="100%" alignItems="center">
    <XStack alignItems="center">
      <Token size="lg" tokenImageUri={data.token.logoURI} />
      <SizableText ml="$3" size="$bodyLgMedium">
        Send
      </SizableText>
    </XStack>
    <NumberSizeableText
      size="$bodyLgMedium"
      formatter="balance"
      formatterOptions={{
        tokenSymbol: data.token.symbol.toUpperCase(),
        showPlusMinusSigns: true,
      }}
    >
      {`-${data.amount}`}
    </NumberSizeableText>
  </XStack>
);

const ApproveTransactionItem = ({
  data,
}: {
  data: IApproveTransactionData;
}) => (
  <XStack justifyContent="space-between" w="100%" alignItems="center">
    <XStack alignItems="center">
      <Token size="lg" tokenImageUri={data.token.logoURI} />
      <SizableText ml="$3" size="$bodyLgMedium">
        Approve
      </SizableText>
    </XStack>
    <XStack>
      {data.isUnlimited ? (
        <SizableText size="$bodyLgMedium" />
      ) : (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="balance"
          formatterOptions={{
            tokenSymbol: data.token.symbol.toUpperCase(),
            showPlusMinusSigns: true,
          }}
        >
          {`-${data.amount}`}
        </NumberSizeableText>
      )}
    </XStack>
  </XStack>
);

const SwapTransactionItem = ({ data }: { data: ISwapTransactionData }) => (
  <XStack justifyContent="space-between" w="100%">
    <XStack alignItems="center">
      <Stack
        w={40}
        h={40}
        alignItems="flex-end"
        justifyContent="flex-end"
        mr="$3"
      >
        <Stack position="absolute" left="$0" top="$0">
          <Token size="sm" tokenImageUri={data.fromToken.logoURI} />
        </Stack>
        <Stack
          borderWidth={2}
          borderColor="$bgApp"
          borderRadius="$full"
          zIndex={1}
        >
          <Token size="sm" tokenImageUri={data.toToken.logoURI} />
        </Stack>
      </Stack>
      <SizableText size="$bodyLgMedium">Swap</SizableText>
    </XStack>
    <YStack alignItems="flex-end">
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="balance"
        formatterOptions={{
          tokenSymbol: data.toToken.symbol.toUpperCase(),
          showPlusMinusSigns: true,
        }}
      >
        {`+${data.toAmount}`}
      </NumberSizeableText>
      <NumberSizeableText
        size="$bodyMd"
        color="$textSubdued"
        formatter="balance"
        formatterOptions={{
          tokenSymbol: data.fromToken.symbol.toUpperCase(),
          showPlusMinusSigns: true,
        }}
      >
        {`-${data.fromAmount}`}
      </NumberSizeableText>
    </YStack>
  </XStack>
);

const TransactionData = ({ data }: { data: ISignedTransaction['data'] }) => {
  if (data.type === 'send') {
    return <SendTransactionItem data={data} />;
  }
  if (data.type === 'approve') {
    return <ApproveTransactionItem data={data} />;
  }
  if (data.type === 'swap') {
    return <SwapTransactionItem data={data} />;
  }
  return null;
};

const TransactionItem = ({ item }: { item: ISignedTransaction }) => {
  const network = item.network;
  const onPress = useCallback(() => {
    openUrl(
      buildExplorerAddressUrl({
        network,
        address: item?.address,
      }),
    );
  }, [item?.address, network]);
  return (
    <YStack
      borderWidth={StyleSheet.hairlineWidth}
      mx="$5"
      borderRadius="$3"
      borderColor="$borderSubdued"
      overflow="hidden"
      mb="$3"
    >
      <XStack justifyContent="space-between" pt="$3" px="$3" pb="$1">
        <SizableText size="$bodyMd">
          {formatTime(new Date(item.createdAt), { hideSeconds: true })}
          {' • '}
          {item.title}
        </SizableText>
        <IconButton
          variant="tertiary"
          icon="OpenOutline"
          size="small"
          onPress={onPress}
        />
      </XStack>
      <XStack p="$3">
        <TransactionData data={item.data} />
      </XStack>
      <XStack p="$3" backgroundColor="$bgSubdued" alignItems="center">
        <Stack mr="$2">
          <NetworkAvatar size={16} networkId={item.networkId} />
        </Stack>
        <SizableText color="$textSubdued">
          {item.network.name} •{' '}
          {utils.shortenAddress({ address: item.address })}
        </SizableText>
      </XStack>
    </YStack>
  );
};

type ISectionListData = {
  title: string;
  data: ISignedTransaction[];
};

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      title={intl.formatMessage({
        id: ETranslations.settings_no_signed_transactions,
      })}
      description={intl.formatMessage({
        id: ETranslations.settings_no_signed_transactions_desc,
      })}
      icon="ClockAlertOutline"
    />
  );
};

export const Transactions = () => {
  const { sections, onEndReached } = useGetSignatureSections(async (params) =>
    backgroundApiProxy.serviceSignature.getSignedTransactions(params),
  );

  return (
    <SectionList
      sections={sections}
      estimatedItemSize="$36"
      ItemSeparatorComponent={null}
      SectionSeparatorComponent={null}
      renderSectionHeader={({ section }) => (
        <SectionList.SectionHeader
          title={(section as ISectionListData).title}
        />
      )}
      renderItem={({ item }) => <TransactionItem item={item} />}
      ListEmptyComponent={ListEmptyComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
    />
  );
};
