import { useCallback, useEffect } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Badge,
  Dialog,
  Icon,
  IconButton,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBtcFindAddressItem } from '@onekeyhq/core/src/chains/btc/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ReceiveTestIDs } from '../testIDs';

// Shared BTC address cell: mono address text + decorative copy icon. The copy
// itself fires from the enclosing row's onPress, so the icon is just an
// affordance. Used by the receive address table, the next-address row and the
// manually-recovered rows so the three stay visually in sync.
export function BtcAddressText({
  displayAddress,
  address,
  copyTestID,
}: {
  displayAddress: string;
  address?: string;
  copyTestID: string;
}) {
  return (
    <>
      <SizableText
        size="$bodyMd"
        color="$text"
        numberOfLines={1}
        flexShrink={1}
        fontFamily="$monoRegular"
        opacity={0.9}
      >
        {displayAddress}
      </SizableText>
      {address ? (
        <Icon
          testID={copyTestID}
          name="Copy3Outline"
          size="$4"
          color="$iconSubdued"
        />
      ) : null}
    </>
  );
}

function FindAddressBalance({
  accountId,
  networkId,
  address,
  decimals,
  symbol,
}: {
  accountId: string;
  networkId: string;
  address: string;
  decimals: number;
  symbol: string;
}) {
  const {
    result,
    isLoading,
    run: retry,
  } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceFreshAddress.fetchBtcFindAddressDetails({
        accountId,
        networkId,
        address,
      }),
    [accountId, networkId, address],
    { watchLoading: true },
  );

  if (isLoading) {
    return <Spinner size="small" />;
  }

  if (!result) {
    return (
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        onPress={() => {
          void retry();
        }}
      >
        —
      </SizableText>
    );
  }

  const value = new BigNumber(result.balance ?? '0').shiftedBy(-decimals);
  const formatted =
    value.isNaN() || !value.isFinite()
      ? '-'
      : `${
          formatBalance(value.toFixed(), { disableThousandSeparator: true })
            .formattedValue
        } ${symbol}`;

  return (
    <SizableText size="$bodyMd" color="$text" numberOfLines={1}>
      {formatted}
    </SizableText>
  );
}

function FindAddressRow({
  item,
  accountId,
  networkId,
  decimals,
  symbol,
  onCopy,
}: {
  item: IBtcFindAddressItem;
  accountId: string;
  networkId: string;
  decimals: number;
  symbol: string;
  onCopy: (item: IBtcFindAddressItem) => void;
}) {
  const intl = useIntl();
  const displayAddress = accountUtils.shortenAddress({
    address: item.address,
    leadingLength: 8,
    trailingLength: 6,
  });

  const onRemove = useCallback(() => {
    Dialog.show({
      icon: 'DeleteOutline',
      tone: 'destructive',
      title: intl.formatMessage({
        id: ETranslations.find_address_remove__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.find_address_remove__desc,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_remove }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
      onConfirm: async () => {
        await backgroundApiProxy.serviceFreshAddress.unclaimBtcFindAddress({
          accountId,
          networkId,
          relPath: item.relPath,
        });
        defaultLogger.transaction.findAddress.claimedAddressRemoved({
          networkId,
        });
      },
    });
  }, [accountId, networkId, item.relPath, intl]);

  return (
    <XStack
      mx="$2"
      px="$3"
      py="$2.5"
      minHeight={44}
      gap="$2"
      alignItems="center"
      borderRadius="$3"
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      $gtMd={{ py: '$2', minHeight: 40 }}
      onPress={() => onCopy(item)}
    >
      <XStack flex={1} minWidth={0} alignItems="center" gap="$1.5">
        <BtcAddressText
          displayAddress={displayAddress}
          address={item.address}
          copyTestID={ReceiveTestIDs.BtcFindAddressCopyButton}
        />
        <Badge badgeType="default" badgeSize="sm">
          <Badge.Text>{`#${item.index}`}</Badge.Text>
        </Badge>
      </XStack>
      <FindAddressBalance
        accountId={accountId}
        networkId={networkId}
        address={item.address}
        decimals={decimals}
        symbol={symbol}
      />
      <ActionList
        title=""
        renderTrigger={
          <IconButton
            testID={ReceiveTestIDs.BtcFindAddressRemoveButton}
            variant="tertiary"
            size="small"
            icon="DotHorOutline"
          />
        }
        items={[
          {
            icon: 'DeleteOutline',
            label: intl.formatMessage({ id: ETranslations.global_remove }),
            destructive: true,
            onPress: onRemove,
          },
        ]}
      />
    </XStack>
  );
}

export function BtcFindAddressSection({
  accountId,
  networkId,
  decimals,
  symbol,
  onCopy,
}: {
  accountId: string;
  networkId: string;
  decimals: number;
  symbol: string;
  onCopy: (item: IBtcFindAddressItem) => void;
}) {
  const intl = useIntl();
  const { result: items, run: refresh } = usePromiseResult(
    async () => {
      if (!accountId || !networkId) return [];
      try {
        return await backgroundApiProxy.serviceFreshAddress.getBtcFindAddresses(
          {
            accountId,
            networkId,
          },
        );
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    [accountId, networkId],
    { initResult: [], revalidateOnFocus: true },
  );

  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    appEventBus.on(EAppEventBusNames.BtcFindAddressUpdated, handler);
    appEventBus.on(EAppEventBusNames.BtcFreshAddressUpdated, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.BtcFindAddressUpdated, handler);
      appEventBus.off(EAppEventBusNames.BtcFreshAddressUpdated, handler);
    };
  }, [refresh]);

  if (!items.length) {
    return null;
  }

  return (
    <YStack>
      <YStack px="$5" gap="$1">
        <SizableText size="$headingSm" color="$text">
          {`${intl.formatMessage({
            id: ETranslations.find_address_recovered_section__title,
          })} (${items.length})`}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.find_address_recovered_section__desc,
          })}
        </SizableText>
      </YStack>
      <YStack>
        {items.map((item) => (
          <FindAddressRow
            key={item.relPath}
            item={item}
            accountId={accountId}
            networkId={networkId}
            decimals={decimals}
            symbol={symbol}
            onCopy={onCopy}
          />
        ))}
      </YStack>
    </YStack>
  );
}
