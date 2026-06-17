import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Badge,
  Dialog,
  IconButton,
  Input,
  SizableText,
  Spinner,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import type { IBtcFindAddressItem } from '@onekeyhq/core/src/chains/btc/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { BTC_FIND_ADDRESS_MAX_INDEX } from '@onekeyhq/shared/src/consts/chainConsts';
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

import { findAddressCopy } from './btcFindAddressCopy';

function parseIndexText(indexText: string): number | undefined {
  if (!/^\d+$/.test(indexText)) {
    return undefined;
  }
  const index = Number(indexText);
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index > BTC_FIND_ADDRESS_MAX_INDEX
  ) {
    return undefined;
  }
  return index;
}

function FindAddressDialogContent({
  accountId,
  networkId,
  accountName,
  accountPath,
  addressTypeLabel,
  deriveType,
}: {
  accountId: string;
  networkId: string;
  accountName: string;
  accountPath: string;
  addressTypeLabel: string;
  deriveType: string;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const [indexText, setIndexText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedIndex = useMemo(() => parseIndexText(indexText), [indexText]);
  const showInvalidHint = indexText.length > 0 && parsedIndex === undefined;
  const pathPreview = `${accountPath}/0/${
    parsedIndex === undefined ? 'N' : parsedIndex
  }`;

  const onConfirm = useCallback(async () => {
    if (parsedIndex === undefined || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const { item, alreadyDiscovered } =
        await backgroundApiProxy.serviceFreshAddress.claimBtcFindAddress({
          accountId,
          networkId,
          index: parsedIndex,
        });
      if (alreadyDiscovered) {
        Toast.message({
          title: findAddressCopy.alreadyDiscovered,
        });
      } else {
        defaultLogger.transaction.findAddress.findAddressClaimed({
          networkId,
          deriveType,
        });
        Toast.success({
          title: `${findAddressCopy.addedToast} · ${findAddressCopy.indexBadge(
            item.index,
          )}`,
        });
      }
      await dialogInstance.close();
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [
    accountId,
    networkId,
    deriveType,
    parsedIndex,
    submitting,
    dialogInstance,
  ]);

  const renderReadonlyRow = (label: string, value: string) => (
    <XStack justifyContent="space-between" alignItems="center" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        size="$bodyMd"
        color="$text"
        numberOfLines={1}
        flexShrink={1}
      >
        {value}
      </SizableText>
    </XStack>
  );

  return (
    <YStack gap="$4">
      <Alert
        type="warning"
        icon="ErrorOutline"
        title={findAddressCopy.warningTitle}
        description={findAddressCopy.warningDesc}
      />
      {renderReadonlyRow(
        findAddressCopy.accountLabel,
        `${accountName} (${accountPath})`,
      )}
      {renderReadonlyRow(findAddressCopy.addressTypeLabel, addressTypeLabel)}
      <YStack gap="$1.5">
        <SizableText size="$bodyMd" color="$textSubdued">
          {findAddressCopy.indexLabel}
        </SizableText>
        <Input
          autoFocus
          testID={ReceiveTestIDs.BtcFindAddressIndexInput}
          size="large"
          $gtMd={{ size: 'medium' }}
          keyboardType="number-pad"
          inputMode="numeric"
          value={indexText}
          placeholder="0"
          onChangeText={(text) => setIndexText(text.trim())}
          error={showInvalidHint}
        />
        {showInvalidHint ? (
          <SizableText size="$bodySm" color="$textCritical">
            {findAddressCopy.invalidIndex}
          </SizableText>
        ) : null}
      </YStack>
      {renderReadonlyRow(findAddressCopy.pathPreviewLabel, pathPreview)}
      <Dialog.Footer
        onConfirm={onConfirm}
        onConfirmText={findAddressCopy.confirmText}
        onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
        confirmButtonProps={{
          disabled: parsedIndex === undefined,
          loading: submitting,
        }}
      />
    </YStack>
  );
}

export function showBtcFindAddressDialog({
  accountId,
  networkId,
  accountName,
  accountPath,
  addressTypeLabel,
  deriveType,
}: {
  accountId: string;
  networkId: string;
  accountName: string;
  accountPath: string;
  addressTypeLabel: string;
  deriveType: string;
}) {
  Dialog.show({
    title: findAddressCopy.dialogTitle,
    renderContent: (
      <FindAddressDialogContent
        accountId={accountId}
        networkId={networkId}
        accountName={accountName}
        accountPath={accountPath}
        addressTypeLabel={addressTypeLabel}
        deriveType={deriveType}
      />
    ),
    showFooter: false,
  });
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
      title: findAddressCopy.removeConfirmTitle,
      description: findAddressCopy.removeConfirmDesc,
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
      mx="$4"
      px="$3"
      py="$2.5"
      gap="$2"
      alignItems="center"
      borderRadius="$3"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={() => onCopy(item)}
    >
      <Badge badgeType="default" badgeSize="sm">
        <Badge.Text>{findAddressCopy.indexBadge(item.index)}</Badge.Text>
      </Badge>
      <SizableText size="$bodyMd" color="$text" numberOfLines={1} flex={1}>
        {displayAddress}
      </SizableText>
      <FindAddressBalance
        accountId={accountId}
        networkId={networkId}
        address={item.address}
        decimals={decimals}
        symbol={symbol}
      />
      <IconButton
        testID={ReceiveTestIDs.BtcFindAddressCopyButton}
        variant="tertiary"
        size="small"
        icon="Copy3Outline"
        onPress={(e) => {
          e?.stopPropagation?.();
          onCopy(item);
        }}
      />
      <IconButton
        testID={ReceiveTestIDs.BtcFindAddressRemoveButton}
        variant="tertiary"
        size="small"
        icon="DeleteOutline"
        onPress={(e) => {
          e?.stopPropagation?.();
          onRemove();
        }}
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
    { initResult: [] },
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
    <YStack gap="$2">
      <YStack px="$5" gap="$1">
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          textTransform="uppercase"
          letterSpacing={0.6}
        >
          {`${findAddressCopy.sectionTitle} · ${items.length}`}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {findAddressCopy.sectionDesc}
        </SizableText>
      </YStack>
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
  );
}
