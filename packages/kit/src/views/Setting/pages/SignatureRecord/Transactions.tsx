import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Empty,
  Icon,
  IconButton,
  Image,
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
import {
  openExplorerAddressUrl,
  openTransactionDetailsUrl,
} from '@onekeyhq/kit/src/utils/explorerUtils';
import { useEarnLabelFn } from '@onekeyhq/kit/src/views/Staking/hooks/useLabelFn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import utils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { ETransactionType } from '@onekeyhq/shared/types/signatureRecord';
import type {
  IApproveTransactionData,
  IEarnTransactionData,
  ISendTransactionData,
  ISignedTransaction,
  ISwapTransactionData,
} from '@onekeyhq/shared/types/signatureRecord';

import { useGetSignatureSections } from './hooks';

const SendTransactionItem = ({ data }: { data: ISendTransactionData }) => {
  const intl = useIntl();
  return (
    <XStack justifyContent="space-between" w="100%" alignItems="center">
      <XStack alignItems="center">
        <Token size="lg" tokenImageUri={data.token.logoURI} />
        <SizableText ml="$3" size="$bodyLgMedium">
          {intl.formatMessage({ id: ETranslations.global_send })}
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
};

const ApproveTransactionItem = ({
  data,
}: {
  data: IApproveTransactionData;
}) => {
  const intl = useIntl();
  return (
    <XStack justifyContent="space-between" w="100%" alignItems="center">
      <XStack alignItems="center">
        <Token size="lg" tokenImageUri={data.token.logoURI} />
        <SizableText ml="$3" size="$bodyLgMedium">
          {intl.formatMessage({ id: ETranslations.global_approve })}
        </SizableText>
      </XStack>
      <XStack>
        {data.isUnlimited ? (
          <SizableText size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.swap_page_provider_approve_amount_un_limit,
            })}
          </SizableText>
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
};

const SwapTransactionItem = ({ data }: { data: ISwapTransactionData }) => {
  const intl = useIntl();
  return (
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
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({ id: ETranslations.global_swap })}
        </SizableText>
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
};

const EarnLidoTransactionItem = ({ data }: { data: IEarnTransactionData }) => {
  const labelFn = useEarnLabelFn();
  let primary = data.receive ? { data: data.receive, symbol: '+' } : undefined;
  let secondary = data.send ? { data: data.send, symbol: '-' } : undefined;
  if (!primary && secondary) {
    primary = secondary;
    secondary = undefined;
  }
  return (
    <XStack justifyContent="space-between" w="100%">
      <XStack alignItems="center">
        <Token
          size="lg"
          tokenImageUri={
            primary?.data?.token.logoURI ?? secondary?.data?.token.logoURI
          }
        />
        <SizableText ml="$3" size="$bodyLgMedium">
          {labelFn(data.label)}
        </SizableText>
      </XStack>
      <YStack alignItems="flex-end" justifyContent="center">
        {primary ? (
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            formatterOptions={{
              tokenSymbol: primary.data.token.symbol,
              showPlusMinusSigns: true,
            }}
          >
            {`${primary.symbol}${primary.data.amount}`}
          </NumberSizeableText>
        ) : null}
        {secondary ? (
          <NumberSizeableText
            size="$bodyMd"
            formatter="balance"
            color="$textSubdued"
            formatterOptions={{
              tokenSymbol: secondary.data.token.symbol,
              showPlusMinusSigns: true,
            }}
          >
            {`${secondary.symbol}${secondary.data.amount}`}
          </NumberSizeableText>
        ) : null}
      </YStack>
    </XStack>
  );
};

const ContractInteractionTransactionItem = () => {
  const intl = useIntl();
  return (
    <XStack justifyContent="space-between" w="100%" alignItems="center">
      <XStack alignItems="center">
        <Image
          borderRadius="$full"
          overflow="hidden"
          width={40}
          height={40}
          mr="$3"
        >
          <Image.Fallback
            alignItems="center"
            justifyContent="center"
            bg="$gray5"
          >
            <Icon size={40} name="GlobusOutline" color="$iconSubdued" />
          </Image.Fallback>
        </Image>
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({
            id: ETranslations.transaction__contract_interaction,
          })}
        </SizableText>
      </XStack>
    </XStack>
  );
};

const TransactionData = ({ data }: { data: ISignedTransaction['data'] }) => {
  if (data.type === ETransactionType.SEND) {
    return <SendTransactionItem data={data} />;
  }
  if (data.type === ETransactionType.APPROVE) {
    return <ApproveTransactionItem data={data} />;
  }
  if (data.type === ETransactionType.SWAP) {
    return <SwapTransactionItem data={data} />;
  }
  if (data.type === ETransactionType.EARN) {
    return <EarnLidoTransactionItem data={data} />;
  }
  if (data.type === ETransactionType.CONTRACT_INTERACTION) {
    return <ContractInteractionTransactionItem />;
  }
  return null;
};

const TransactionItem = ({ item }: { item: ISignedTransaction }) => {
  const network = item.network;
  const vaultSettings = item.vaultSettings;
  const intl = useIntl();
  const onPress = useCallback(() => {
    if (item.hash) {
      void openTransactionDetailsUrl({
        networkId: network.id,
        txid: item.hash,
      });
    } else {
      void openExplorerAddressUrl({
        networkId: network.id,
        address: item.address,
      });
    }
  }, [item, network]);
  return (
    <Stack px="$5" pb="$3">
      <YStack
        borderWidth={StyleSheet.hairlineWidth}
        borderRadius="$3"
        borderColor="$borderSubdued"
        overflow="hidden"
      >
        <XStack justifyContent="space-between" pt="$3" px="$3" pb="$1">
          <SizableText size="$bodyMd">
            {formatTime(new Date(item.createdAt), { hideSeconds: true })}
            {' • '}
            {item.title}
          </SizableText>
          {!vaultSettings.hideBlockExplorer ? (
            <IconButton
              variant="tertiary"
              title={
                item.hash
                  ? intl.formatMessage({
                      id: ETranslations.settings_view_transaction_in_explorer,
                    })
                  : intl.formatMessage({
                      id: ETranslations.settings_view_address_in_explorer,
                    })
              }
              icon={item.hash ? 'OpenOutline' : 'GlobusOutline'}
              size="small"
              onPress={onPress}
            />
          ) : null}
        </XStack>
        <XStack p="$3">
          <XStack h={44} width="100%" alignItems="center">
            <TransactionData data={item.data} />
          </XStack>
        </XStack>
        <XStack p="$3" backgroundColor="$bgSubdued" alignItems="center">
          <Stack mr="$2">
            <NetworkAvatar size={16} networkId={item.networkId} />
          </Stack>
          <SizableText color="$textSubdued" size="$bodySmMedium">
            {item.network.name} •{' '}
            {utils.shortenAddress({ address: item.address })}
          </SizableText>
        </XStack>
      </YStack>
    </Stack>
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

const keyExtractor = (item: unknown) => {
  const hash = (item as ISignedTransaction)?.hash;
  const createdAt = (item as ISignedTransaction)?.createdAt;
  // lighting/ sui tx don't have tx hash
  return hash || String(createdAt);
};

export const Transactions = () => {
  const { sections, onEndReached } = useGetSignatureSections(async (params) =>
    backgroundApiProxy.serviceSignature.getSignedTransactions(params),
  );

  return (
    <SectionList
      sections={sections}
      estimatedItemSize={158}
      ItemSeparatorComponent={null}
      SectionSeparatorComponent={null}
      renderSectionHeader={({ section }) => (
        <SectionList.SectionHeader
          title={(section as ISectionListData).title}
        />
      )}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => <TransactionItem item={item} />}
      ListEmptyComponent={ListEmptyComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
    />
  );
};
