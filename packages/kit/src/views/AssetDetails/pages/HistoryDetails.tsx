import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IStackProps, IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Divider,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalAssetDetailsParamList } from '@onekeyhq/shared/src/routes/assetDetails';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import {
  getHistoryTxDetailInfo,
  getOnChainHistoryTxAssetInfo,
} from '@onekeyhq/shared/src/utils/historyUtils';
import { buildTransactionDetailsUrl } from '@onekeyhq/shared/src/utils/uriUtils';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type {
  IOnChainHistoryTxApprove,
  IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';
import type {
  IDecodedTxActionTokenApprove,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { openUrl } from '../../../utils/openUrl';

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
      key: 'transaction__success',
      color: '$textSuccess',
    };
  }

  return {
    key: 'transaction__failed',
    color: '$textCritical',
  };
}

export function InfoItemGroup({ children, ...rest }: IXStackProps) {
  return (
    <XStack p="$2.5" flexWrap="wrap" {...rest}>
      {children}
    </XStack>
  );
}

export function InfoItem({
  label,
  renderContent,
  compact = false,
  showCopy = false,
  showOpenWithUrl = undefined,
  disabledCopy = false,
  ...rest
}: {
  label?: string;
  renderContent: ReactNode;
  compact?: boolean;
  disabledCopy?: boolean;
  showCopy?: boolean;
  showOpenWithUrl?: string;
} & IStackProps) {
  const { copyText } = useClipboard();
  return (
    <Stack
      flex={1}
      flexBasis="100%"
      p="$2.5"
      space="$2"
      {...(compact && {
        $gtMd: {
          flexBasis: '50%',
        },
      })}
      {...rest}
    >
      {label ? <SizableText size="$bodyMdMedium">{label}</SizableText> : null}
      {typeof renderContent === 'string' ? (
        <YStack
          gap="$1.5"
          onPress={() => {
            if (!disabledCopy) {
              copyText(renderContent);
            }
          }}
        >
          <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
            {renderContent}
          </SizableText>
          <XStack space="$2">
            {showCopy ? (
              <IconButton
                icon="Copy2Outline"
                size="small"
                pointerEvents="none"
              />
            ) : null}
            {showOpenWithUrl ? (
              <IconButton
                icon="OpenOutline"
                size="small"
                onPress={() => openUrl(showOpenWithUrl)}
              />
            ) : null}
          </XStack>
        </YStack>
      ) : (
        renderContent
      )}
    </Stack>
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
  return (
    <ListItem key={index}>
      <Token
        isNFT={asset.isNFT}
        tokenImageUri={asset.icon}
        networkImageUri={networkIcon}
      />
      <ListItem.Text primary={asset.symbol} secondary={asset.name} flex={1} />
      <ListItem.Text
        primary={
          isApprove ? (
            <SizableText
              textAlign="right"
              size="$bodyLgMedium"
              color="$textSuccess"
            >
              {isApproveUnlimited
                ? intl.formatMessage({
                    id: ETranslations.swap_page_button_approve_unlimited,
                  })
                : intl.formatMessage(
                    { id: ETranslations.form__approve_str },
                    {
                      amount,
                      symbol: asset.symbol,
                    },
                  )}
            </SizableText>
          ) : (
            <NumberSizeableText
              textAlign="right"
              size="$bodyLgMedium"
              color={
                direction === EDecodedTxDirection.IN ? '$textSuccess' : '$text'
              }
              formatter="balance"
              formatterOptions={{
                tokenSymbol: asset.isNFT ? '' : asset.symbol,
                showPlusMinusSigns: true,
              }}
            >
              {`${direction === EDecodedTxDirection.IN ? '+' : '-'}${amount}`}
            </NumberSizeableText>
          )
        }
        secondary={
          isApproveUnlimited ? null : (
            <NumberSizeableText
              textAlign="right"
              size="$bodyMd"
              color="$textSubdued"
              formatter="value"
              formatterOptions={{ currency: currencySymbol }}
            >
              {new BigNumber(amount).times(asset.price ?? 0).toString()}
            </NumberSizeableText>
          )
        }
        align="right"
      />
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

  const { networkId, accountAddress, historyTx, xpub } = route.params;

  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const resp = usePromiseResult(
    () =>
      Promise.all([
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
        backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
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
    [accountAddress, historyTx.decodedTx.txid, networkId, xpub],
    { watchLoading: true },
  );

  const [network, vaultSettings, txDetailsResp, nativeToken] =
    resp.result ?? [];

  const { data: txDetails, tokens = {}, nfts = {} } = txDetailsResp ?? {};

  const handleViewUTXOsOnPress = useCallback(() => {
    navigation.push(EModalAssetDetailRoutes.UTXODetails, {
      networkId,
      txId: historyTx.decodedTx.txid,
      inputs: historyTx.decodedTx.actions[0].assetTransfer?.utxoFrom,
      outputs: historyTx.decodedTx.actions[0].assetTransfer?.utxoTo,
    });
  }, [
    historyTx.decodedTx.actions,
    historyTx.decodedTx.txid,
    navigation,
    networkId,
  ]);

  const renderAssetsChange = useCallback(
    ({
      transfers,
      localTransfers,
      approve,
      localApprove,
      direction,
    }: {
      transfers: IOnChainHistoryTxTransfer[] | undefined;
      localTransfers: IDecodedTxTransferInfo[] | undefined;
      approve: IOnChainHistoryTxApprove | undefined;
      localApprove: IDecodedTxActionTokenApprove | undefined;
      direction: EDecodedTxDirection | undefined;
    }) => {
      if (approve) {
        const asset = getOnChainHistoryTxAssetInfo({
          tokenAddress: approve.token,
          tokens,
          nfts,
        });

        return (
          <AssetItem
            index={0}
            asset={asset}
            direction={direction}
            amount={new BigNumber(approve.amount)
              .shiftedBy(-asset.decimals)
              .toFixed()}
            isApprove
            isApproveUnlimited={approve.isInfiniteAmount}
            networkIcon={network?.logoURI ?? ''}
            currencySymbol={settings.currencyInfo.symbol}
          />
        );
      }

      if (localApprove) {
        const asset = {
          name: localApprove.name,
          symbol: localApprove.symbol,
          icon: localApprove.icon ?? '',
          price: '0',
        };

        return (
          <AssetItem
            index={0}
            asset={asset}
            direction={direction}
            isApprove
            isApproveUnlimited={localApprove.isInfiniteAmount}
            amount={localApprove.amount}
            networkIcon={network?.logoURI ?? ''}
            currencySymbol={settings.currencyInfo.symbol}
          />
        );
      }

      if (transfers) {
        return transfers?.map((transfer, index) => {
          const asset = getOnChainHistoryTxAssetInfo({
            tokenAddress: transfer.token,
            tokens,
            nfts,
          });

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
      }
      return localTransfers?.map((transfer, index) => {
        const asset = {
          name: transfer.name,
          symbol: transfer.symbol,
          icon: transfer.icon,
          isNFT: transfer.isNFT,
          isNative: transfer.isNative,
          price: '0',
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
    [network?.logoURI, nfts, settings.currencyInfo.symbol, tokens],
  );

  const transfersToRender = useMemo(() => {
    let transfers: {
      transfers?: IOnChainHistoryTxTransfer[];
      localTransfers?: IDecodedTxTransferInfo[];
      approve?: IOnChainHistoryTxApprove;
      localApprove?: IDecodedTxActionTokenApprove;
      direction?: EDecodedTxDirection;
    }[] = [];

    let sends = txDetails?.sends;
    let receives = txDetails?.receives;
    const localSends = historyTx.decodedTx.actions[0].assetTransfer?.sends;
    const localReceives =
      historyTx.decodedTx.actions[0].assetTransfer?.receives;

    if (vaultSettings?.isUtxo && txDetails) {
      sends = sends?.filter((send) => send.isOwn);
      receives = receives?.filter((receive) => receive.isOwn);

      if (
        txDetails.type === EOnChainHistoryTxType.Send &&
        sends &&
        !isEmpty(sends)
      ) {
        sends = [
          {
            ...sends[0],
            from: txDetails.from,
            to: txDetails.to,
            amount: txDetails.value,
          },
        ];
        receives = [];
      } else if (
        txDetails.type === EOnChainHistoryTxType.Receive &&
        receives &&
        !isEmpty(receives)
      ) {
        receives = [
          {
            ...receives[0],
            from: txDetails.from,
            to: txDetails.to,
            amount: txDetails.value,
          },
        ];
        sends = [];
      }
    }

    const approve = txDetails?.tokenApprove;
    const localApprove = historyTx.decodedTx.actions[0].tokenApprove;
    transfers = [
      {
        transfers: sends,
        localTransfers: localSends,
        direction: EDecodedTxDirection.OUT,
      },
      {
        transfers: receives,
        localTransfers: localReceives,
        direction: EDecodedTxDirection.IN,
      },
      {
        approve,
        localApprove,
      },
    ];

    return transfers.filter(Boolean);
  }, [historyTx.decodedTx.actions, txDetails, vaultSettings?.isUtxo]);

  const txAddresses = useMemo(() => {
    if (!txDetails) {
      const { decodedTx } = historyTx;
      const sends = historyTx.decodedTx.actions[0].assetTransfer?.sends ?? [];
      if (vaultSettings?.isUtxo) {
        return {
          from: historyTx.decodedTx.signer,
          to: sends?.map((send) => send.to).join('/n'),
          isSingleTransfer: sends?.length === 1,
        };
      }

      return {
        from: decodedTx.signer,
        to: decodedTx.to ?? decodedTx.actions[0].assetTransfer?.to,
        isSingleTransfer:
          decodedTx.actions[0].assetTransfer?.sends?.length === 1,
      };
    }

    if (vaultSettings?.isUtxo) {
      const utxoSends = txDetails.sends.filter(
        (send) => send.from !== accountAddress,
      );
      const utxoReceives = txDetails.receives.filter(
        (receive) => receive.to !== accountAddress,
      );

      const from =
        utxoSends.length > 1
          ? `${utxoSends.length} addresses`
          : utxoSends[0]?.from ?? txDetails.sends[0]?.from ?? txDetails.from;

      const to =
        utxoReceives.length > 1
          ? `${utxoReceives.length} addresses`
          : utxoReceives[0]?.to ?? txDetails.receives[0]?.to ?? txDetails.to;

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

    return {
      from: txDetails?.from,
      to: txDetails?.to,
      isSingleTransfer: new BigNumber(txDetails.sends?.length ?? 0)
        .plus(txDetails.receives?.length ?? 0)
        .eq(1),
    };
  }, [accountAddress, historyTx, txDetails, vaultSettings?.isUtxo]);

  const renderTxStatus = useCallback(() => {
    const { key, color } = getTxStatusTextProps(historyTx.decodedTx.status);
    return (
      <XStack h="$5" alignItems="center">
        <SizableText size="$bodyMdMedium" color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        {vaultSettings?.replaceTxEnabled &&
        historyTx.decodedTx.status === EDecodedTxStatus.Pending ? (
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
  }, [historyTx.decodedTx.status, intl, vaultSettings?.replaceTxEnabled]);

  const renderTxFlow = useCallback(() => {
    if (vaultSettings?.isUtxo && !txAddresses.isSingleTransfer) return null;

    if (txAddresses.from && txAddresses.to && txAddresses.isSingleTransfer) {
      return (
        <>
          <InfoItem label="From" renderContent={txAddresses.from} showCopy />
          <InfoItem label="To" renderContent={txAddresses.to} showCopy />
        </>
      );
    }

    if (txAddresses.to) {
      return (
        <InfoItem
          label="Interact with Contract"
          renderContent={txAddresses.to}
          showCopy
        />
      );
    }
  }, [
    txAddresses.from,
    txAddresses.isSingleTransfer,
    txAddresses.to,
    vaultSettings?.isUtxo,
  ]);

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
        <SizableText size="$bodyMd" color="$textSubdued">
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
              localTransfers: block.localTransfers,
              transfers: block.transfers,
              approve: block.approve,
              localApprove: block.localApprove,
              direction: block.direction,
            }),
          )}
        </Stack>

        {/* Part 2: Details */}
        <Stack>
          {/* Primary */}
          <InfoItemGroup>
            <InfoItem label="Status" renderContent={renderTxStatus()} compact />
            <InfoItem label="Date" renderContent={txInfo.date} compact />
          </InfoItemGroup>
          {/* Secondary */}
          <Divider mx="$5" />
          <InfoItemGroup>
            {renderTxFlow()}
            {vaultSettings?.isUtxo ? (
              <InfoItem
                renderContent={
                  <Button
                    size="medium"
                    onPress={handleViewUTXOsOnPress}
                    variant="secondary"
                  >
                    View Inputs & Outputs
                  </Button>
                }
              />
            ) : null}
            <InfoItem
              label="Transaction ID"
              renderContent={txInfo.txid}
              showCopy
              showOpenWithUrl={buildTransactionDetailsUrl({
                network,
                txid: txInfo.txid,
              })}
            />
            <InfoItem
              label="Network Fee"
              renderContent={renderFeeInfo()}
              compact
            />
            {vaultSettings?.nonceRequired && !isNil(txInfo.nonce) ? (
              <InfoItem
                label="Nonce"
                renderContent={String(txInfo.nonce)}
                compact
              />
            ) : null}
            {!isNil(txInfo.confirmations) ? (
              <InfoItem
                label="Confirmations"
                renderContent={String(txInfo.confirmations)}
                compact
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
    renderTxStatus,
    txInfo.date,
    txInfo.txid,
    txInfo.nonce,
    txInfo.confirmations,
    txInfo.swapInfo,
    renderTxFlow,
    vaultSettings?.isUtxo,
    vaultSettings?.nonceRequired,
    handleViewUTXOsOnPress,
    network,
    renderFeeInfo,
    renderAssetsChange,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={txDetails?.label} />
      <Page.Body>{renderHistoryDetails()}</Page.Body>
    </Page>
  );
}

export { HistoryDetails };
