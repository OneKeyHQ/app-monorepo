import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalAssetDetailsParamList } from '@onekeyhq/shared/src/routes/assetDetails';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import { getHistoryTxDetailInfo } from '@onekeyhq/shared/src/utils/historyUtils';
import { buildTransactionDetailsUrl } from '@onekeyhq/shared/src/utils/uriUtils';
import {
  EHistoryTxDetailsBlock,
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IDecodedTxActionTokenApprove,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { getHistoryTxMeta } from '../../utils';

import { InfoItem, InfoItemGroup } from './components/TxDetailsInfoItem';

import type { RouteProp } from '@react-navigation/core';
import type { ColorValue } from 'react-native';

function getTxStatusTextProps(status: EDecodedTxStatus): {
  key: ETranslations;
  color: ColorValue;
} {
  if (status === EDecodedTxStatus.Pending) {
    return {
      key: ETranslations.global_pending,
      color: '$textCaution',
    };
  }

  if (status === EDecodedTxStatus.Confirmed) {
    return {
      key: ETranslations.global_success,
      color: '$textSuccess',
    };
  }

  return {
    key: ETranslations.global_failed,
    color: '$textCritical',
  };
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
}: {
  asset: {
    name: string;
    symbol: string;
    icon: string;
    isNFT?: boolean;
    isNative?: boolean;
    price: string;
  };
  index: number;
  direction?: EDecodedTxDirection;
  amount: string;
  networkIcon: string;
  currencySymbol: string;
  isApprove?: boolean;
  isApproveUnlimited?: boolean;
}) {
  const intl = useIntl();
  let primary = null;
  let secondary = null;

  const amountAbs = new BigNumber(amount).abs().toFixed();

  if (isApprove) {
    primary = (
      <SizableText textAlign="right" size="$bodyLgMedium" color="$textSuccess">
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
      </SizableText>
    );
  } else if (!amount) {
    primary = (
      <SizableText textAlign="right" size="$bodyLgMedium" color="$text">
        -
      </SizableText>
    );
    secondary = primary;
  } else {
    primary = (
      <NumberSizeableText
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
      </NumberSizeableText>
    );
    secondary = (
      <NumberSizeableText
        textAlign="right"
        size="$bodyMd"
        color="$textSubdued"
        formatter="value"
        formatterOptions={{ currency: currencySymbol }}
      >
        {new BigNumber(amountAbs).times(asset.price ?? 0).toString()}
      </NumberSizeableText>
    );
  }

  return (
    <ListItem key={index}>
      <Token
        isNFT={asset.isNFT}
        tokenImageUri={asset.icon}
        networkImageUri={networkIcon}
      />
      <ListItem.Text primary={asset.symbol} secondary={asset.name} flex={1} />
      <ListItem.Text primary={primary} secondary={secondary} align="right" />
    </ListItem>
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

  const { accountId, networkId, accountAddress, historyTx, xpub } =
    route.params;

  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const resp = usePromiseResult(
    () =>
      Promise.all([
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
        backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
          accountId,
          networkId,
          accountAddress,
          xpub,
          txid: historyTx.decodedTx.txid,
        }),
        backgroundApiProxy.serviceToken.getNativeToken({
          networkId,
          accountAddress,
        }),
      ]),
    [accountAddress, historyTx.decodedTx.txid, networkId, accountId, xpub],
    { watchLoading: true },
  );

  const [network, vaultSettings, txDetailsResp, nativeToken] =
    resp.result ?? [];

  const { data: txDetails } = txDetailsResp ?? {};

  const handleViewUTXOsOnPress = useCallback(() => {
    navigation.push(EModalAssetDetailRoutes.UTXODetails, {
      accountId,
      networkId,
      txId: historyTx.decodedTx.txid,
      inputs: historyTx.decodedTx.actions[0]?.assetTransfer?.utxoFrom,
      outputs: historyTx.decodedTx.actions[0]?.assetTransfer?.utxoTo,
    });
  }, [
    historyTx.decodedTx.actions,
    historyTx.decodedTx.txid,
    navigation,
    accountId,
    networkId,
  ]);

  const txAddresses = useMemo(() => {
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
          : utxoSends[0]?.from ?? sends[0]?.from ?? decodedTx.signer;

      const to =
        utxoReceives.length > 1
          ? intl.formatMessage(
              { id: ETranslations.explore_addresses_count },
              { 'number': utxoReceives.length },
            )
          : utxoReceives[0]?.to ??
            receives[0]?.to ??
            decodedTx.to ??
            decodedTx.actions[0]?.assetTransfer?.to;
      return {
        from,
        to,
        isSingleTransfer:
          from === to
            ? true
            : new BigNumber(utxoSends.length ?? 0)
                .plus(utxoReceives.length ?? 0)
                .eq(1),
      };
    }

    const from = decodedTx.signer;
    const to = decodedTx.to ?? decodedTx.actions[0]?.assetTransfer?.to;

    return {
      from,
      to,
      isSingleTransfer:
        from === to
          ? true
          : new BigNumber(sends?.length ?? 0).plus(receives?.length ?? 0).eq(1),
    };
  }, [accountAddress, historyTx, intl, vaultSettings?.isUtxo]);

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
          price: '0',
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
          price: transfer.price ?? '0',
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
          />
        );
      });
    },
    [network?.logoURI, settings.currencyInfo.symbol],
  );

  const isSendToSelf = useMemo(
    () =>
      !!(
        txAddresses.isSingleTransfer &&
        txAddresses.from &&
        txAddresses.to &&
        txAddresses.from === txAddresses.to &&
        !isEmpty(historyTx.decodedTx.actions[0]?.assetTransfer?.sends)
      ),
    [
      historyTx.decodedTx.actions,
      txAddresses.from,
      txAddresses.isSingleTransfer,
      txAddresses.to,
    ],
  );

  const transfersToRender = useMemo(() => {
    let transfers: {
      transfers?: IDecodedTxTransferInfo[];
      approve?: IDecodedTxActionTokenApprove;
      direction?: EDecodedTxDirection;
    }[] = [];

    const { decodedTx } = historyTx;

    let sends = decodedTx.actions[0]?.assetTransfer?.sends;
    let receives = decodedTx.actions[0]?.assetTransfer?.receives;
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
    } else if (onChainTxPayload) {
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
  }, [historyTx, isSendToSelf, vaultSettings?.isUtxo]);

  const renderTxStatus = useCallback(() => {
    const status =
      txDetails?.status === EOnChainHistoryTxStatus.Success
        ? EDecodedTxStatus.Confirmed
        : historyTx.decodedTx.status;
    const { key, color } = getTxStatusTextProps(status);
    return (
      <XStack h="$5" alignItems="center">
        <SizableText size="$bodyMdMedium" color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        {vaultSettings?.replaceTxEnabled &&
        status === EDecodedTxStatus.Pending ? (
          <XStack ml="$5">
            <Button size="small" variant="primary">
              Speed Up
            </Button>
            <Button size="small" variant="secondary" ml="$2.5">
              Cancel
            </Button>
          </XStack>
        ) : null}
      </XStack>
    );
  }, [
    historyTx.decodedTx.status,
    intl,
    txDetails?.status,
    vaultSettings?.replaceTxEnabled,
  ]);

  const renderTxFlow = useCallback(() => {
    if (vaultSettings?.isUtxo && !txAddresses.isSingleTransfer) return null;

    if (txAddresses.from && txAddresses.to && txAddresses.isSingleTransfer) {
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
              />
            }
          />
        </>
      );
    }

    if (txAddresses.to) {
      return (
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.interact_with_contract,
          })}
          renderContent={txAddresses.to}
          showCopy
        />
      );
    }
  }, [
    vaultSettings?.isUtxo,
    txAddresses.isSingleTransfer,
    txAddresses.from,
    txAddresses.to,
    intl,
    networkId,
    accountId,
  ]);

  const renderTxMetaInfo = useCallback(() => {
    const components = getHistoryTxMeta({ impl: network?.impl ?? '' });
    const TxFlow = components?.[EHistoryTxDetailsBlock.Flow];
    const TxAttributes = components?.[EHistoryTxDetailsBlock.Attributes];

    return (
      <>
        {TxFlow ? <TxFlow decodedTx={historyTx.decodedTx} /> : renderTxFlow()}
        {TxAttributes ? (
          <TxAttributes decodedTx={historyTx.decodedTx} txDetails={txDetails} />
        ) : null}
      </>
    );
  }, [historyTx.decodedTx, network?.impl, renderTxFlow, txDetails]);

  const txInfo = getHistoryTxDetailInfo({
    txDetails,
    historyTx,
  });

  const renderFeeInfo = useCallback(
    () => (
      <XStack alignItems="center">
        <NumberSizeableText
          formatter="balance"
          size="$bodyMd"
          color="$textSubdued"
          formatterOptions={{
            tokenSymbol: nativeToken?.symbol,
          }}
        >
          {txInfo?.gasFee}
        </NumberSizeableText>
        <SizableText size="$bodyMd" color="$textSubdued" ml="$1">
          (
          <NumberSizeableText
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {txInfo?.gasFeeFiatValue ?? '0'}
          </NumberSizeableText>
          )
        </SizableText>
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
    if (resp.isLoading) {
      return (
        <Stack pt={240} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    return (
      <>
        {/* Part 1: What change */}
        <Stack>
          {transfersToRender.map((block) =>
            renderAssetsChange({
              transfers: block.transfers,
              approve: block.approve,
              direction: block.direction,
            }),
          )}
        </Stack>

        {/* Part 2: Details */}
        <Stack>
          {/* Primary */}
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({ id: ETranslations.global_status })}
              renderContent={renderTxStatus()}
              compact
            />
            <InfoItem
              label={intl.formatMessage({ id: ETranslations.global_time })}
              renderContent={txInfo.date}
              compact
            />
          </InfoItemGroup>
          {/* Secondary */}
          <Divider mx="$5" />
          <InfoItemGroup>
            {renderTxMetaInfo()}
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.global_transaction_id,
              })}
              renderContent={txInfo.txid}
              showCopy
              showOpenWithUrl={buildTransactionDetailsUrl({
                network,
                txid: txInfo.txid,
              })}
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_network_fee,
              })}
              renderContent={renderFeeInfo()}
              compact
            />
            {new BigNumber(txInfo.blockHeight ?? 0).isGreaterThan(0) ? (
              <InfoItem
                label="Block Height"
                renderContent={String(txInfo.blockHeight)}
                compact
              />
            ) : null}
            {vaultSettings?.nonceRequired && !isNil(txInfo.nonce) ? (
              <InfoItem
                label="Nonce"
                renderContent={String(txInfo.nonce)}
                compact
              />
            ) : null}

            {new BigNumber(txInfo.confirmations ?? 0).isGreaterThan(0) ? (
              <InfoItem
                label={intl.formatMessage({
                  id: ETranslations.global_confirmations,
                })}
                renderContent={String(txInfo.confirmations)}
                compact
              />
            ) : null}
            {vaultSettings?.isUtxo ? (
              <InfoItem
                renderContent={
                  <Button
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
          {/* Tertiary */}
          {txInfo.swapInfo ? (
            <>
              <Divider mx="$5" />
              <InfoItemGroup>
                <InfoItem
                  label="Rate"
                  renderContent="1 ETH = 2229.259 USDC"
                  compact
                />
                <InfoItem
                  label="Application"
                  renderContent={
                    <XStack>
                      <Image
                        src="https://cdn.1inch.io/logo.png"
                        w="$5"
                        h="$5"
                      />
                      <SizableText
                        size="$bodyMd"
                        color="$textSubdued"
                        pl="$1.5"
                      >
                        1inch
                      </SizableText>
                    </XStack>
                  }
                  compact
                />
                <InfoItem label="Protocol Fee" renderContent="$0.12" compact />
                <InfoItem
                  label="OneKey Fee"
                  renderContent="0.3% (0.002 ETH)"
                  compact
                />
              </InfoItemGroup>
            </>
          ) : null}
        </Stack>
      </>
    );
  }, [
    resp.isLoading,
    transfersToRender,
    intl,
    renderTxStatus,
    txInfo.date,
    txInfo.txid,
    txInfo.nonce,
    txInfo.blockHeight,
    txInfo.confirmations,
    txInfo.swapInfo,
    renderTxMetaInfo,
    vaultSettings?.isUtxo,
    vaultSettings?.nonceRequired,
    handleViewUTXOsOnPress,
    network,
    renderFeeInfo,
    renderAssetsChange,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={historyTx.decodedTx.payload?.label} />
      <Page.Body testID="history-details-body">
        {renderHistoryDetails()}
      </Page.Body>
    </Page>
  );
}

export { HistoryDetails };
