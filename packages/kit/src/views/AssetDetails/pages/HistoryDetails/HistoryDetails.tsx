import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { SpeedUpAction } from '@onekeyhq/kit/src/components/TxHistoryListView/SpeedUpAction';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReplaceTx } from '@onekeyhq/kit/src/hooks/useReplaceTx';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import {
  isPrivateSendHistoryTx,
  maybeOpenPrivateSendHistoryDetail,
} from '@onekeyhq/kit/src/views/Swap/utils/privateSendHistory';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { IMPL_DOT, IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalAssetDetailsParamList } from '@onekeyhq/shared/src/routes/assetDetails';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getHistoryTxDetailInfo } from '@onekeyhq/shared/src/utils/historyUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EHistoryTxDetailsBlock,
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import { ENotificationPushMessageAckAction } from '@onekeyhq/shared/types/notification';
import type {
  IDecodedTxActionTokenApprove,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxDirection,
  EDecodedTxStatus,
  EReplaceTxType,
} from '@onekeyhq/shared/types/tx';

import { getHistoryTxMeta } from '../../utils';

import { InfoItem, InfoItemGroup } from './components/TxDetailsInfoItem';
import { TxKYTRiskCheck } from './components/TxKYTRiskCheck';
import { getTxConfirmSubtitle } from './txConfirmSubtitle';

import type { RouteProp } from '@react-navigation/core';
import type { ColorValue } from 'react-native';

function getTxStatusTextProps(
  status: EDecodedTxStatus | EOnChainHistoryTxStatus | undefined,
): {
  key: ETranslations;
  color: ColorValue;
  // True only for an explicitly-broadcast Pending tx; gates the spinner and ETA
  // subtitle. The unknown/not-yet-loaded fallback below shows the "confirming"
  // copy but leaves this false (no live tx to estimate yet).
  isConfirming: boolean;
} {
  if (
    status === EDecodedTxStatus.Pending ||
    status === EOnChainHistoryTxStatus.Pending
  ) {
    // A broadcast on-chain tx is "confirming", not "pending" (OK-56372).
    return {
      key: ETranslations.global_confirming,
      color: '$textCaution',
      isConfirming: true,
    };
  }

  if (
    status === EDecodedTxStatus.Confirmed ||
    status === EOnChainHistoryTxStatus.Success
  ) {
    return {
      key: ETranslations.global_success,
      color: '$textSuccess',
      isConfirming: false,
    };
  }

  if (
    status === EDecodedTxStatus.Dropped ||
    status === EDecodedTxStatus.Removed ||
    status === EDecodedTxStatus.Failed ||
    status === EOnChainHistoryTxStatus.Failed
  ) {
    return {
      key: ETranslations.global_failed,
      color: '$textCritical',
      isConfirming: false,
    };
  }

  // Unknown / not-yet-loaded status is treated as confirming (OK-56372).
  return {
    key: ETranslations.global_confirming,
    color: '$textCaution',
    isConfirming: false,
  };
}

// Compact action button used in the confirming-state status row (OK-56372 §6).
// Button locks the font size to its `size` variant with no override prop, so we
// render custom text via `childrenAsText={false}` to get `$bodySmMedium`.
function CompactReplaceButton({
  variant = 'secondary',
  children,
  testID,
  onPress,
}: {
  variant?: 'primary' | 'secondary';
  children: string;
  testID?: string;
  onPress?: () => void;
}) {
  return (
    <Button
      testID={testID}
      size="small"
      variant={variant}
      childrenAsText={false}
      px="$3"
      onPress={onPress}
    >
      <SizableText
        size="$bodySmMedium"
        color={variant === 'primary' ? '$textInverse' : '$text'}
      >
        {children}
      </SizableText>
    </Button>
  );
}

export function AssetItem({
  asset,
  index,
  direction,
  amount,
  networkIcon,
  currencySymbol,
  isApprove,
  isApproveUnlimited,
  isAllNetworks,
  networkId,
}: {
  asset: {
    name: string;
    symbol: string;
    icon: string;
    isNFT?: boolean;
    isNative?: boolean;
    price?: string;
  };
  index: number;
  direction?: EDecodedTxDirection;
  amount: string;
  networkIcon: string;
  currencySymbol: string;
  isApprove?: boolean;
  isApproveUnlimited?: boolean;
  isAllNetworks?: boolean;
  networkId?: string;
}) {
  const intl = useIntl();
  let primary = null;
  let secondary = null;

  const amountAbs = new BigNumber(amount).abs().toFixed();

  if (isApprove) {
    if (new BigNumber(amountAbs).eq(0)) {
      primary = (
        <SizableText
          textAlign="right"
          size="$bodyLgMedium"
          color="$textSuccess"
        >
          {intl.formatMessage(
            { id: ETranslations.global_revoke_approve },
            {
              symbol: asset.symbol,
            },
          )}
        </SizableText>
      );
    } else {
      primary = (
        <NumberSizeableTextWrapper
          hideValue
          textAlign="right"
          size="$bodyLgMedium"
          color="$textSuccess"
          formatter="value"
        >
          {isApproveUnlimited
            ? intl.formatMessage({
                id: ETranslations.swap_page_button_approve_unlimited,
              })
            : intl.formatMessage(
                { id: ETranslations.form__approve_str },
                {
                  amount: amountAbs,
                  symbol: asset.symbol,
                },
              )}
        </NumberSizeableTextWrapper>
      );
    }
  } else if (!amount) {
    primary = (
      <NumberSizeableTextWrapper
        hideValue
        formatter="value"
        textAlign="right"
        size="$bodyLgMedium"
        color="$text"
      >
        -
      </NumberSizeableTextWrapper>
    );
    secondary = primary;
  } else {
    primary = (
      <NumberSizeableTextWrapper
        hideValue
        numberOfLines={1}
        textAlign="right"
        size="$bodyLgMedium"
        color={direction === EDecodedTxDirection.IN ? '$textSuccess' : '$text'}
        formatter="balance"
        formatterOptions={{
          tokenSymbol: asset.isNFT ? '' : asset.symbol,
          showPlusMinusSigns: true,
        }}
      >
        {`${direction === EDecodedTxDirection.IN ? '+' : '-'}${amountAbs}`}
      </NumberSizeableTextWrapper>
    );
    secondary = !isNil(asset.price) ? (
      <NumberSizeableTextWrapper
        hideValue
        textAlign="right"
        size="$bodyMd"
        color="$textSubdued"
        formatter="value"
        formatterOptions={{ currency: currencySymbol }}
      >
        {new BigNumber(amountAbs).times(asset.price ?? 0).toFixed()}
      </NumberSizeableTextWrapper>
    ) : null;
  }

  return (
    <ListItem key={index}>
      <Token
        isNFT={asset.isNFT}
        tokenImageUri={asset.icon}
        networkImageUri={isAllNetworks ? networkIcon : undefined}
        showNetworkIcon={isAllNetworks}
        networkId={networkId}
      />
      <ListItem.Text
        flexGrow={1}
        flexBasis={0}
        minWidth={96}
        primary={asset.isNFT ? asset.name : asset.symbol}
        primaryTextProps={{
          numberOfLines: 1,
        }}
        secondary={asset.name}
      />
      <ListItem.Text
        flexShrink={1}
        primary={primary}
        secondary={secondary}
        align="right"
      />
    </ListItem>
  );
}

function NotificationAccountInfo({
  notificationAccountId,
  networkId,
  allowClickAccountNameSwitch,
  addressMap,
}: {
  notificationAccountId: string;
  networkId: string;
  allowClickAccountNameSwitch: boolean | undefined;
  addressMap?: Record<string, IAddressInfo>;
}) {
  const { account: notificationAccount } = useAccountData({
    networkId,
    accountId: notificationAccountId,
  });
  const notificationAccountAddress = useMemo(
    () =>
      notificationAccount?.addressDetail?.normalizedAddress ||
      notificationAccount?.address,
    [notificationAccount],
  );
  const intl = useIntl();

  // account may be deleted
  if (!notificationAccountAddress) {
    return null;
  }

  return (
    <>
      <Divider mx="$5" />
      <InfoItemGroup>
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.history_notification_receiver_label,
          })}
          renderContent={notificationAccountAddress}
          compact
          description={
            notificationAccountAddress ? (
              <AddressInfo
                address={notificationAccountAddress}
                accountId={notificationAccount?.id}
                networkId={networkId}
                allowClickAccountNameSwitch={allowClickAccountNameSwitch}
                addressMap={addressMap}
              />
            ) : null
          }
        />
      </InfoItemGroup>
    </>
  );
}

function HistoryDetails() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.HistoryDetails
      >
    >();

  const {
    accountId,
    networkId,
    transactionHash,
    notificationId,
    notificationAccountId,
    allowClickAccountNameSwitch,
    historyTx: historyTxParam,
    isAllNetworks,
    checkIsFocused = true,
  } = route.params;

  const historyInit = useRef(false);
  const historyConfirmed = useRef(false);
  const privateSendSwapDetailOpened = useRef(false);

  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();

  const { account, network, vaultSettings } = useAccountData({
    networkId,
    accountId,
  });

  const accountAddress = route.params?.accountAddress || account?.address;
  const txid = transactionHash || historyTxParam?.decodedTx.txid || '';
  const isInitialPrivateSendHistory = historyTxParam
    ? isPrivateSendHistoryTx(historyTxParam)
    : false;

  useEffect(() => {
    privateSendSwapDetailOpened.current = false;
  }, [isInitialPrivateSendHistory, txid]);

  const openPrivateSendHistoryDetailOnce = useCallback(
    async (historyTx: IAccountHistoryTx) => {
      if (!isPrivateSendHistoryTx(historyTx)) {
        return false;
      }
      if (privateSendSwapDetailOpened.current) {
        return true;
      }
      privateSendSwapDetailOpened.current = true;
      return maybeOpenPrivateSendHistoryDetail({
        historyTx,
        navigation,
        accountId,
        accountAddress,
        network,
        currencySymbol: settings.currencyInfo.symbol,
      });
    },
    [
      accountAddress,
      accountId,
      navigation,
      network,
      settings.currencyInfo.symbol,
    ],
  );

  const nativeToken = usePromiseResult(
    () =>
      backgroundApiProxy.serviceToken.getNativeToken({
        accountId,
        networkId,
      }),
    [accountId, networkId],
  ).result;

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (isInitialPrivateSendHistory && historyTxParam) {
        historyInit.current = true;
        await openPrivateSendHistoryDetailOnce(historyTxParam);
        return {
          txDetails: undefined,
          decodedOnChainTx: historyTxParam,
          addressMap: undefined,
        };
      }

      if (!accountAddress) return;
      const r = await backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
        accountId,
        networkId,
        accountAddress,
        txid,
        fixConfirmedTxStatus: vaultSettings?.fixConfirmedTxEnabled,
      });
      historyInit.current = true;
      if (
        r?.data &&
        r?.data.status !== EOnChainHistoryTxStatus.Pending &&
        historyTxParam?.decodedTx.status === EDecodedTxStatus.Pending
      ) {
        historyConfirmed.current = true;
        appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
      }

      let decodedOnChainTx: IAccountHistoryTx | undefined = historyTxParam;

      if (!decodedOnChainTx && r?.data) {
        decodedOnChainTx =
          await backgroundApiProxy.serviceHistory.decodeOnChainHistoryTx({
            accountId,
            networkId,
            accountAddress,
            tx: r.data,
            tokens: r.tokens,
            nfts: r.nfts,
          });
      }

      if (decodedOnChainTx && isPrivateSendHistoryTx(decodedOnChainTx)) {
        await openPrivateSendHistoryDetailOnce(decodedOnChainTx);
        return {
          txDetails: undefined,
          decodedOnChainTx,
          addressMap: undefined,
        };
      }

      return {
        txDetails: r?.data,
        decodedOnChainTx,
        addressMap: r?.addressMap,
      };
    },

    [
      accountAddress,
      accountId,
      networkId,
      txid,
      vaultSettings?.fixConfirmedTxEnabled,
      historyTxParam,
      isInitialPrivateSendHistory,
      openPrivateSendHistoryDetailOnce,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      watchLoading: true,
      alwaysSetState: true,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
      checkIsFocused,
      // Seed the last-known detail synchronously on re-open so the confirming
      // subtitle (ETA) renders immediately instead of flashing the "waiting"
      // fallback before the request resolves (OK-56372).
      swrKey: txid
        ? swrKeys.historyTxDetail({ networkId, accountAddress, txid })
        : undefined,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused &&
        !privateSendSwapDetailOpened.current &&
        (!historyInit.current ||
          ((historyTxParam?.decodedTx.status ?? EDecodedTxStatus.Pending) ===
            EDecodedTxStatus.Pending &&
            !historyConfirmed.current)),
    },
  );

  const { txDetails, decodedOnChainTx, addressMap } = result || {};
  const historyTx = historyTxParam ?? decodedOnChainTx;

  // Prefer the detail response's KYT block, falling back to the one carried from
  // the history list so the section renders before the detail request resolves.
  const kytResult = useMemo(
    () => txDetails?.kyt ?? historyTx?.decodedTx.kyt,
    [txDetails?.kyt, historyTx?.decodedTx.kyt],
  );
  const kytReceives = useMemo(
    () =>
      historyTx?.decodedTx.actions?.flatMap(
        (action) => action.assetTransfer?.receives ?? [],
      ) ?? [],
    [historyTx?.decodedTx.actions],
  );

  useEffect(() => {
    if (txDetails && notificationId) {
      void backgroundApiProxy.serviceNotification.ackNotificationMessage({
        msgId: notificationId,
        action: ENotificationPushMessageAckAction.readed,
      });
    }
  }, [txDetails, notificationId]);

  const handleReplaceTxSuccess = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  const {
    handleReplaceTx,
    handleCheckSpeedUpState,
    canReplaceTx,
    canCancelTx,
    cancelTxEnabled,
    speedUpCancelEnabled,
    checkSpeedUpStateEnabled,
  } = useReplaceTx({
    historyTx,
    onSuccess: handleReplaceTxSuccess,
    isConfirmed:
      txDetails && txDetails.status !== EOnChainHistoryTxStatus.Pending,
  });

  const handleViewUTXOsOnPress = useCallback(() => {
    navigation.push(EModalAssetDetailRoutes.UTXODetails, {
      accountId,
      networkId,
      txId: txid,
      inputs: historyTx?.decodedTx.actions[0]?.assetTransfer?.utxoFrom,
      outputs: historyTx?.decodedTx.actions[0]?.assetTransfer?.utxoTo,
    });
  }, [navigation, accountId, networkId, txid, historyTx?.decodedTx.actions]);

  const txAddresses = useMemo(() => {
    if (!historyTx) {
      return undefined;
    }
    const { decodedTx } = historyTx;
    const sends = historyTx.decodedTx.actions[0]?.assetTransfer?.sends ?? [];
    const receives =
      historyTx.decodedTx.actions[0]?.assetTransfer?.receives ?? [];

    if (vaultSettings?.isUtxo) {
      const utxoSends = sends.filter((send) => send.from !== accountAddress);
      const utxoReceives = receives.filter(
        (receive) => receive.to !== accountAddress,
      );

      const from =
        utxoSends.length > 1
          ? intl.formatMessage(
              { id: ETranslations.explore_addresses_count },
              { 'number': utxoSends.length },
            )
          : (utxoSends[0]?.from ?? sends[0]?.from ?? decodedTx.signer);

      const to =
        utxoReceives.length > 1
          ? intl.formatMessage(
              { id: ETranslations.explore_addresses_count },
              { 'number': utxoReceives.length },
            )
          : (utxoReceives[0]?.to ??
            receives[0]?.to ??
            decodedTx.to ??
            decodedTx.actions[0]?.assetTransfer?.to);
      return {
        from,
        to,
        isSingleTransfer:
          from === to
            ? true
            : new BigNumber(utxoSends.length ?? 0)
                .plus(utxoReceives.length ?? 0)
                .isLessThanOrEqualTo(1),
      };
    }

    const from = decodedTx.signer;
    let to = decodedTx.actions[0]?.assetTransfer?.to ?? decodedTx.to;
    if (vaultSettings?.impl === IMPL_DOT && !to) {
      to = txDetails?.to;
    }
    // Solana: For Receive type transactions, get the actual receiving address from receives array
    if (
      vaultSettings?.impl === IMPL_SOL &&
      isEmpty(sends) &&
      !isEmpty(receives)
    ) {
      to = receives[0]?.to ?? to;
    }

    return {
      from,
      to,
      isSingleFrom: [...sends, ...receives].every((e) => e.from === from),
      isSingleTo: [...sends, ...receives].every((e) => e.to === to),
      isSingleTransfer:
        from === to
          ? true
          : new BigNumber(sends?.length ?? 0).plus(receives?.length ?? 0).eq(1),
    };
  }, [
    accountAddress,
    historyTx,
    intl,
    txDetails?.to,
    vaultSettings?.impl,
    vaultSettings?.isUtxo,
  ]);

  const renderAssetsChange = useCallback(
    ({
      transfers,
      approve,
      direction,
    }: {
      transfers: IDecodedTxTransferInfo[] | undefined;
      approve: IDecodedTxActionTokenApprove | undefined;
      direction: EDecodedTxDirection | undefined;
    }) => {
      if (approve) {
        const asset = {
          name: approve.name,
          symbol: approve.symbol,
          icon: approve.icon ?? '',
        };

        return (
          <AssetItem
            index={0}
            asset={asset}
            direction={direction}
            isApprove
            isApproveUnlimited={approve.isInfiniteAmount}
            amount={approve.amount}
            networkIcon={network?.logoURI ?? ''}
            currencySymbol={settings.currencyInfo.symbol}
            isAllNetworks={isAllNetworks}
            networkId={networkId}
          />
        );
      }

      return transfers?.map((transfer, index) => {
        const asset = {
          name: transfer.name,
          symbol: transfer.symbol,
          icon: transfer.icon,
          isNFT: transfer.isNFT,
          isNative: transfer.isNative,
          price: transfer.price,
        };

        return (
          <AssetItem
            key={index}
            index={index}
            asset={asset}
            direction={direction}
            amount={transfer.amount}
            networkIcon={network?.logoURI ?? ''}
            currencySymbol={settings.currencyInfo.symbol}
            isAllNetworks={isAllNetworks}
            networkId={networkId}
          />
        );
      });
    },
    [isAllNetworks, network?.logoURI, networkId, settings.currencyInfo.symbol],
  );

  const isSendToSelf = useMemo(
    () =>
      !!(
        txAddresses &&
        txAddresses.isSingleTransfer &&
        txAddresses.from &&
        txAddresses.to &&
        txAddresses.from === txAddresses.to &&
        !isEmpty(historyTx?.decodedTx.actions[0]?.assetTransfer?.sends) &&
        historyTx?.decodedTx.actions[0]?.assetTransfer?.sends[0]
          ?.tokenIdOnNetwork ===
          historyTx?.decodedTx.actions[0]?.assetTransfer?.receives[0]
            ?.tokenIdOnNetwork
      ),
    [historyTx?.decodedTx.actions, txAddresses],
  );

  const historyDetailsTitle = useMemo(() => {
    if (!historyTx) {
      return '';
    }
    const { decodedTx } = historyTx;
    const label = historyTx.decodedTx.payload?.label;
    let title = label;
    const type = historyTx.decodedTx.payload?.type;
    const sends = decodedTx.actions[0]?.assetTransfer?.sends;
    const receives = decodedTx.actions[0]?.assetTransfer?.receives;

    if (isSendToSelf) {
      title = intl.formatMessage({ id: ETranslations.global_send });
    } else if (!isEmpty(sends) && isEmpty(receives)) {
      title = intl.formatMessage({ id: ETranslations.global_send });
    } else if (isEmpty(sends) && !isEmpty(receives)) {
      title = intl.formatMessage({ id: ETranslations.global_receive });
    } else if (type === EOnChainHistoryTxType.Send) {
      title = intl.formatMessage({ id: ETranslations.global_send });
    } else if (type === EOnChainHistoryTxType.Receive) {
      title = intl.formatMessage({ id: ETranslations.global_receive });
    }

    if (
      !historyTx.isLocalCreated ||
      (decodedTx.status !== EDecodedTxStatus.Pending && label)
    ) {
      title = label;
    }

    if (!title && decodedTx.actions[0]?.assetTransfer?.isInternalSwap) {
      title = intl.formatMessage({
        id: ETranslations.global_swap,
      });
    }

    return title;
  }, [historyTx, intl, isSendToSelf]);

  const transfersToRender = useMemo(() => {
    if (!historyTx) {
      return undefined;
    }
    let transfers: {
      transfers?: IDecodedTxTransferInfo[];
      approve?: IDecodedTxActionTokenApprove;
      direction?: EDecodedTxDirection;
    }[] = [];

    const { decodedTx } = historyTx;

    let sends = decodedTx.actions[0]?.assetTransfer?.sends;
    let receives = decodedTx.actions[0]?.assetTransfer?.receives;
    if (vaultSettings?.impl === IMPL_DOT) {
      sends = decodedTx.actions[0]?.assetTransfer?.sends.map((e, i) => ({
        ...e,
        ...txDetails?.sends?.[i],
      }));
      receives = decodedTx.actions[0]?.assetTransfer?.receives.map((e, i) => ({
        ...e,
        ...txDetails?.receives?.[i],
      }));
    }

    const onChainTxPayload = historyTx.decodedTx.payload;

    if (vaultSettings?.isUtxo) {
      sends = sends?.filter((send) => (isNil(send.isOwn) ? true : send.isOwn));
      receives = receives?.filter((receive) =>
        isNil(receive.isOwn) ? true : receive.isOwn,
      );
    }

    if (
      isSendToSelf &&
      onChainTxPayload &&
      sends &&
      !isEmpty(sends) &&
      !vaultSettings?.isUtxo
    ) {
      receives = [];
    } else if (vaultSettings?.isUtxo && onChainTxPayload) {
      if (
        onChainTxPayload.type === EOnChainHistoryTxType.Send &&
        sends &&
        !isEmpty(sends)
      ) {
        sends = [
          {
            ...sends[0],
            from: decodedTx.signer,
            to: decodedTx.to ?? decodedTx.actions[0]?.assetTransfer?.to ?? '',
            amount: onChainTxPayload.value,
          },
        ];
        receives = [];
      } else if (
        onChainTxPayload.type === EOnChainHistoryTxType.Receive &&
        receives &&
        !isEmpty(receives)
      ) {
        receives = [
          {
            ...receives[0],
            from: decodedTx.signer,
            to: decodedTx.to ?? decodedTx.actions[0]?.assetTransfer?.to ?? '',
            amount: onChainTxPayload.value,
          },
        ];
        sends = [];
      }
    }

    const approve = historyTx.decodedTx.actions[0]?.tokenApprove;
    transfers = [
      {
        transfers: sends,
        direction: EDecodedTxDirection.OUT,
      },
      {
        transfers: receives,
        direction: EDecodedTxDirection.IN,
      },
      {
        approve,
      },
    ];

    return transfers.filter(Boolean);
  }, [
    historyTx,
    isSendToSelf,
    txDetails?.receives,
    txDetails?.sends,
    vaultSettings?.impl,
    vaultSettings?.isUtxo,
  ]);

  const renderReplaceTxActions = useCallback(() => {
    if (!canReplaceTx && !checkSpeedUpStateEnabled) return null;

    const renderCancelActions = () => (
      <XStack gap="$2">
        <SpeedUpAction
          compact
          networkId={networkId}
          onSpeedUp={() =>
            handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp })
          }
        />
        {cancelTxEnabled ? (
          <CompactReplaceButton
            testID="asset-details-render-cancel-actions-btn"
            onPress={() =>
              handleReplaceTx({ replaceType: EReplaceTxType.Cancel })
            }
          >
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </CompactReplaceButton>
        ) : null}
      </XStack>
    );

    const renderSpeedUpCancelAction = () => (
      <>
        {speedUpCancelEnabled ? (
          <CompactReplaceButton
            testID="asset-details-render-speed-up-cancel-action-btn"
            variant="primary"
            onPress={() =>
              handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp })
            }
          >
            {intl.formatMessage({
              id: ETranslations.speed_up_cancellation,
            })}
          </CompactReplaceButton>
        ) : null}
      </>
    );

    const renderCheckSpeedUpState = () => (
      <CompactReplaceButton
        testID="asset-details-render-check-speed-up-state-btn"
        variant="primary"
        onPress={() => handleCheckSpeedUpState()}
      >
        {intl.formatMessage({
          id: ETranslations.tx_accelerate_order_inquiry_label,
        })}
      </CompactReplaceButton>
    );

    const renderReplaceButtons = () => {
      if (!canReplaceTx) return null;
      return canCancelTx ? renderCancelActions() : renderSpeedUpCancelAction();
    };

    return (
      <XStack ml="$2">
        {renderReplaceButtons()}
        {checkSpeedUpStateEnabled ? renderCheckSpeedUpState() : null}
      </XStack>
    );
  }, [
    canCancelTx,
    canReplaceTx,
    cancelTxEnabled,
    speedUpCancelEnabled,
    checkSpeedUpStateEnabled,
    handleReplaceTx,
    handleCheckSpeedUpState,
    networkId,
    intl,
  ]);

  const renderTxStatus = useCallback(() => {
    const status = txDetails?.status ?? historyTx?.decodedTx.status;
    const { key, color, isConfirming } = getTxStatusTextProps(status);

    const broadcastTimeMs = txDetails?.timestamp
      ? txDetails.timestamp * 1000
      : (historyTx?.decodedTx.updatedAt ?? historyTx?.decodedTx.createdAt);
    const subtitle = isConfirming
      ? getTxConfirmSubtitle({
          confirmationETASeconds: txDetails?.confirmationETASeconds,
          confirmationETABlocks: txDetails?.confirmationETABlocks,
          broadcastTimeMs,
          nowMs: Date.now(),
        })
      : null;

    return (
      <YStack gap="$1">
        <XStack minHeight="$5" alignItems="center">
          {isConfirming ? <Spinner size="small" mr="$2" /> : null}
          <SizableText size="$bodyMdMedium" color={color}>
            {intl.formatMessage({ id: key })}
          </SizableText>
          {historyTx?.replacedType &&
          txDetails?.status === EOnChainHistoryTxStatus.Pending ? (
            <Badge badgeSize="sm" badgeType="info" ml="$2">
              {intl.formatMessage({
                id:
                  historyTx?.replacedType === EReplaceTxType.SpeedUp
                    ? ETranslations.global_sped_up
                    : ETranslations.global_cancelling,
              })}
            </Badge>
          ) : null}
          {renderReplaceTxActions()}
        </XStack>
        {subtitle ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: subtitle.id }, subtitle.values)}
          </SizableText>
        ) : null}
      </YStack>
    );
  }, [
    historyTx?.decodedTx.status,
    historyTx?.decodedTx.updatedAt,
    historyTx?.decodedTx.createdAt,
    intl,
    renderReplaceTxActions,
    txDetails?.status,
    txDetails?.timestamp,
    txDetails?.confirmationETASeconds,
    txDetails?.confirmationETABlocks,
    historyTx?.replacedType,
  ]);

  const renderTxFlow = useCallback(() => {
    const action = historyTx?.decodedTx.actions[0];

    if (action?.assetTransfer?.isInternalSwap) {
      const { from, to, swapReceivedAddress, swapReceivedNetworkId } =
        action.assetTransfer;
      return (
        <>
          {to ? (
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.interact_with_contract,
              })}
              renderContent={to}
              showCopy
              description={
                <AddressInfo
                  address={to}
                  networkId={networkId}
                  accountId={accountId}
                  allowClickAccountNameSwitch={allowClickAccountNameSwitch}
                  addressMap={addressMap}
                />
              }
            />
          ) : null}
          <InfoItem
            label={intl.formatMessage({
              id: ETranslations.swap_history_detail_pay_address,
            })}
            renderContent={from}
            showCopy
            description={
              <AddressInfo
                address={from}
                networkId={networkId}
                accountId={accountId}
                allowClickAccountNameSwitch={allowClickAccountNameSwitch}
                addressMap={addressMap}
              />
            }
          />
          <InfoItem
            label={intl.formatMessage({
              id: ETranslations.swap_history_detail_received_address,
            })}
            renderContent={swapReceivedAddress}
            showCopy
            description={
              <AddressInfo
                address={swapReceivedAddress ?? ''}
                networkId={swapReceivedNetworkId ?? ''}
                accountId={accountId}
                allowClickAccountNameSwitch={allowClickAccountNameSwitch}
                addressMap={addressMap}
              />
            }
          />
        </>
      );
    }

    if (vaultSettings?.isUtxo && !txAddresses?.isSingleTransfer) return null;
    if (
      txAddresses?.from &&
      txAddresses?.to &&
      (txAddresses?.isSingleTransfer ||
        (txAddresses?.isSingleFrom && txAddresses?.isSingleTo))
    ) {
      return (
        <>
          <InfoItem
            label={intl.formatMessage({ id: ETranslations.global_from })}
            renderContent={txAddresses.from}
            showCopy
            description={
              <AddressInfo
                address={txAddresses.from}
                networkId={networkId}
                accountId={accountId}
                allowClickAccountNameSwitch={allowClickAccountNameSwitch}
                addressMap={addressMap}
              />
            }
          />
          <InfoItem
            label={intl.formatMessage({ id: ETranslations.global_to })}
            renderContent={txAddresses.to}
            showCopy
            description={
              <AddressInfo
                address={txAddresses.to}
                networkId={networkId}
                accountId={accountId}
                allowClickAccountNameSwitch={allowClickAccountNameSwitch}
                addressMap={addressMap}
              />
            }
          />
        </>
      );
    }

    if (txAddresses?.to) {
      return (
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.interact_with_contract,
          })}
          renderContent={txAddresses.to}
          description={
            <AddressInfo
              address={txAddresses.to}
              networkId={networkId}
              accountId={accountId}
              allowClickAccountNameSwitch={allowClickAccountNameSwitch}
              addressMap={addressMap}
            />
          }
          showCopy
        />
      );
    }
  }, [
    historyTx?.decodedTx.actions,
    vaultSettings?.isUtxo,
    txAddresses?.isSingleTransfer,
    txAddresses?.from,
    txAddresses?.to,
    txAddresses?.isSingleFrom,
    txAddresses?.isSingleTo,
    intl,
    networkId,
    accountId,
    allowClickAccountNameSwitch,
    addressMap,
  ]);

  const renderTxApproveFor = useCallback(() => {
    const approve = historyTx?.decodedTx.actions[0]?.tokenApprove;

    if (approve) {
      return (
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.global_for,
          })}
          renderContent={approve.spender}
          showCopy
          description={
            <AddressInfo
              address={approve.spender}
              networkId={networkId}
              accountId={accountId}
              addressMap={addressMap}
            />
          }
        />
      );
    }
  }, [historyTx?.decodedTx.actions, intl, networkId, accountId, addressMap]);

  const renderTxMetaInfo = useCallback(() => {
    const components = getHistoryTxMeta({ impl: network?.impl ?? '' });
    const TxFlow = components?.[EHistoryTxDetailsBlock.Flow];
    const TxAttributes = components?.[EHistoryTxDetailsBlock.Attributes];

    return (
      <>
        {TxFlow && historyTx?.decodedTx ? (
          <TxFlow decodedTx={historyTx?.decodedTx} addressMap={addressMap} />
        ) : (
          renderTxFlow()
        )}
        {renderTxApproveFor()}
        {TxAttributes && historyTx?.decodedTx ? (
          <TxAttributes
            decodedTx={historyTx?.decodedTx}
            txDetails={txDetails}
          />
        ) : null}
      </>
    );
  }, [
    historyTx?.decodedTx,
    network?.impl,
    renderTxApproveFor,
    renderTxFlow,
    txDetails,
    addressMap,
  ]);

  const txInfo = getHistoryTxDetailInfo({
    txDetails,
    historyTx,
  });

  const renderFeeInfo = useCallback(
    () => (
      <XStack alignItems="center">
        <NumberSizeableTextWrapper
          formatter="balance"
          size="$bodyMd"
          color="$textSubdued"
          formatterOptions={{
            tokenSymbol: nativeToken?.symbol,
          }}
        >
          {txInfo?.gasFee}
        </NumberSizeableTextWrapper>
        {!isNil(txInfo?.gasFeeFiatValue) ? (
          <SizableText size="$bodyMd" color="$textSubdued" ml="$1">
            (
            <NumberSizeableTextWrapper
              formatter="value"
              formatterOptions={{ currency: settings.currencyInfo.symbol }}
              size="$bodyMd"
              color="$textSubdued"
            >
              {txInfo?.gasFeeFiatValue ?? '0'}
            </NumberSizeableTextWrapper>
            )
          </SizableText>
        ) : null}
      </XStack>
    ),
    [
      nativeToken?.symbol,
      settings.currencyInfo.symbol,
      txInfo?.gasFee,
      txInfo?.gasFeeFiatValue,
    ],
  );

  const renderHistoryDetails = useCallback(() => {
    // On the notification path no `historyTx` is passed in, so the detail is
    // fetched on mount. `isLoading` starts as `undefined` and, because the
    // request is debounced, only flips to `true` after the debounce window —
    // during that gap the previous `isLoading &&` guard fell through and
    // rendered the detail skeleton whose empty (undefined) status shows as
    // "Pending", flashing a brief "待处理" frame before the spinner. Treat
    // "fetch path, not yet initialized, loading not settled to false" as
    // loading so the spinner shows immediately and the pending placeholder is
    // never rendered.
    if (!historyTxParam && !historyInit.current && isLoading !== false) {
      return (
        <Stack pt={240} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    return (
      <>
        {/* Part 1: What change */}
        <Stack testID="history-details-what-assets-change">
          {transfersToRender?.map((block) =>
            renderAssetsChange({
              transfers: block.transfers,
              approve: block.approve,
              direction: block.direction,
            }),
          )}
        </Stack>

        {/* Part 2: Details */}
        <Stack testID="history-details-main-content">
          {/* Primary */}
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({ id: ETranslations.global_status })}
              renderContent={renderTxStatus()}
              compact
            />
            <InfoItem
              label={intl.formatMessage({ id: ETranslations.global_time })}
              renderContent={txInfo?.date}
              compact
            />
          </InfoItemGroup>

          {/* KYT Risk Check — hidden for watch-only accounts */}
          {accountId && accountUtils.isWatchingAccount({ accountId }) ? null : (
            <TxKYTRiskCheck
              kyt={kytResult}
              transfers={kytReceives}
              networkName={network?.name}
            />
          )}

          {/* Notification account */}
          {notificationAccountId ? (
            <NotificationAccountInfo
              notificationAccountId={notificationAccountId}
              networkId={networkId}
              allowClickAccountNameSwitch={allowClickAccountNameSwitch}
              addressMap={addressMap}
            />
          ) : null}

          {/* Secondary */}
          <Divider mx="$5" />
          <InfoItemGroup>
            {renderTxMetaInfo()}
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.global_transaction_id,
              })}
              renderContent={txid}
              showCopy
              openWithUrl={
                vaultSettings?.hideBlockExplorer
                  ? undefined
                  : () => {
                      void openTransactionDetailsUrl({
                        networkId: network?.id,
                        txid,
                      });
                    }
              }
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_network_fee,
              })}
              renderContent={renderFeeInfo()}
              compact
            />

            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.global_network,
              })}
              renderContent={network?.name || '--'}
              compact
            />
            {new BigNumber(txInfo?.blockHeight ?? 0).isGreaterThan(0) ? (
              <InfoItem
                label={intl.formatMessage({
                  id: ETranslations.global_block_height,
                })}
                renderContent={String(txInfo?.blockHeight)}
                compact
              />
            ) : null}
            {vaultSettings?.nonceRequired && !isNil(txInfo?.nonce) ? (
              <InfoItem
                label="Nonce"
                renderContent={String(txInfo?.nonce)}
                compact
              />
            ) : null}

            {new BigNumber(txInfo?.confirmations ?? 0).isGreaterThan(0) ? (
              <InfoItem
                label={intl.formatMessage({
                  id: ETranslations.global_confirmations,
                })}
                renderContent={String(txInfo?.confirmations)}
                compact
              />
            ) : null}

            {vaultSettings?.isUtxo &&
            (historyTx?.decodedTx.status !== EDecodedTxStatus.Pending ||
              !vaultSettings.hideTxUtxoListWhenPending) ? (
              <InfoItem
                renderContent={
                  <Button
                    testID="asset-details-btn"
                    size="medium"
                    onPress={handleViewUTXOsOnPress}
                    variant="secondary"
                    iconAfter="ChevronRightSmallOutline"
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_inputs,
                    })}{' '}
                    &{' '}
                    {intl.formatMessage({
                      id: ETranslations.global_outputs,
                    })}
                  </Button>
                }
              />
            ) : null}
          </InfoItemGroup>
        </Stack>
      </>
    );
  }, [
    isLoading,
    historyTxParam,
    transfersToRender,
    intl,
    renderTxStatus,
    txInfo?.date,
    txInfo?.blockHeight,
    txInfo?.nonce,
    txInfo?.confirmations,
    notificationAccountId,
    networkId,
    allowClickAccountNameSwitch,
    addressMap,
    renderTxMetaInfo,
    txid,
    vaultSettings?.hideBlockExplorer,
    vaultSettings?.nonceRequired,
    vaultSettings?.isUtxo,
    vaultSettings?.hideTxUtxoListWhenPending,
    renderFeeInfo,
    network?.name,
    network?.id,
    historyTx?.decodedTx.status,
    handleViewUTXOsOnPress,
    renderAssetsChange,
    kytResult,
    kytReceives,
    accountId,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={historyDetailsTitle} />
      <Page.Body testID="history-details-body">
        {renderHistoryDetails()}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(HistoryDetails);
