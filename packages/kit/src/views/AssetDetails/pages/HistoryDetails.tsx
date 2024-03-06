import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type {
  ILocaleIds,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
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
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { getOnChainHistoryTxAssetInfo } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IOnChainHistoryTxTransfer } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalAssetDetailRoutes } from '../router/types';

import type { IModalAssetDetailsParamList } from '../router/types';
import type { RouteProp } from '@react-navigation/core';
import type { ColorValue } from 'react-native';

function getTxStatusTextProps(status: EDecodedTxStatus): {
  key: ILocaleIds;
  color: ColorValue;
} {
  if (status === EDecodedTxStatus.Pending) {
    return {
      key: 'transaction__pending',
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
    color: '$textError',
  };
}

function InfoItemGroup({ children, ...rest }: IXStackProps) {
  return (
    <XStack p="$2.5" flexWrap="wrap" {...rest}>
      {children}
    </XStack>
  );
}

function InfoItem({
  label,
  renderContent,
  compact = false,
  ...rest
}: {
  label: string;
  renderContent: ReactNode;
  compact?: boolean;
} & IStackProps) {
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
      <SizableText size="$bodyMdMedium">{label}</SizableText>
      {typeof renderContent === 'string' ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {renderContent}
        </SizableText>
      ) : (
        renderContent
      )}
    </Stack>
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

  const { networkId, accountAddress, historyTx } = route.params;

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
          txid: historyTx.decodedTx.txid,
        }),
        backgroundApiProxy.serviceToken.getNativeToken({ networkId }),
      ]),
    [accountAddress, historyTx.decodedTx.txid, networkId],
    { watchLoading: true },
  );

  const [network, vaultSettings, txDetailsResp, nativeToken] =
    resp.result ?? [];

  const { data: txDetails, tokens = {}, nfts = {} } = txDetailsResp ?? {};

  const handleOnViewUTXOsPress = useCallback(() => {
    if (!txDetails) return;
    const { inputs: onChainInputs, outputs: onChainOutputs } = txDetails;

    navigation.push(EModalAssetDetailRoutes.UTXODetails, {
      inputs: onChainInputs?.map((input) => ({
        address: input.addresses[0],
        value: input.value,
      })),
      outputs: onChainOutputs?.map((output) => ({
        address: output.addresses[0],
        value: output.value,
      })),
    });
  }, [navigation, txDetails]);

  const renderAssetsChange = useCallback(
    ({
      transfers,
      direction,
    }: {
      transfers: IOnChainHistoryTxTransfer[] | undefined;
      direction: EDecodedTxDirection;
    }) =>
      transfers?.map((transfer, index) => {
        const asset = getOnChainHistoryTxAssetInfo({
          tokenAddress: transfer.token,
          tokens,
          nfts,
        });
        return (
          <ListItem key={index}>
            <Token
              isNFT={asset.isNFT}
              tokenImageUri={asset.icon}
              networkImageUri={network?.logoURI}
            />
            <ListItem.Text
              primary={asset.symbol}
              secondary={asset.name}
              flex={1}
            />
            <ListItem.Text
              primary={
                <NumberSizeableText
                  textAlign="right"
                  size="$bodyLgMedium"
                  color={
                    direction === EDecodedTxDirection.IN
                      ? '$textSuccess'
                      : '$text'
                  }
                  formatter="balance"
                  formatterOptions={{
                    tokenSymbol: asset.isNFT ? '' : asset.symbol,
                    showPlusMinusSigns: true,
                  }}
                >
                  {`${direction === EDecodedTxDirection.IN ? '+' : '-'}${
                    transfer.amount
                  }`}
                </NumberSizeableText>
              }
              secondary={
                <NumberSizeableText
                  textAlign="right"
                  size="$bodyMd"
                  color="$textSubdued"
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                >
                  {new BigNumber(transfer.amount)
                    .times(asset.price ?? 0)
                    .toString()}
                </NumberSizeableText>
              }
              align="right"
            />
          </ListItem>
        );
      }),
    [network?.logoURI, nfts, settings.currencyInfo.symbol, tokens],
  );

  const renderTxStatus = useCallback(() => {
    const { key, color } = getTxStatusTextProps(historyTx.decodedTx.status);
    return (
      <XStack h="$5" alignItems="center">
        <SizableText size="$bodyMdMedium" color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        {historyTx.decodedTx.status === EDecodedTxStatus.Pending && (
          <XStack ml="$5">
            <Button size="small" variant="primary">
              Speed Up
            </Button>
            <Button size="small" variant="secondary" ml="$2.5">
              Cancel
            </Button>
          </XStack>
        )}
      </XStack>
    );
  }, [historyTx.decodedTx.status, intl]);

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
          {txDetails?.gasFee}
        </NumberSizeableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          (
          <NumberSizeableText
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {txDetails?.gasFeeFiatValue}
          </NumberSizeableText>
          )
        </SizableText>
      </XStack>
    ),
    [
      nativeToken?.symbol,
      settings.currencyInfo.symbol,
      txDetails?.gasFee,
      txDetails?.gasFeeFiatValue,
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

    if (!txDetails) return null;

    return (
      <>
        {/* Part 1: What change */}
        <Stack>
          {renderAssetsChange({
            transfers: txDetails.sends,
            direction: EDecodedTxDirection.OUT,
          })}
          {renderAssetsChange({
            transfers: txDetails.receives,
            direction: EDecodedTxDirection.IN,
          })}
        </Stack>

        {/* Part 2: Details */}
        <Stack>
          {/* Primary */}
          <InfoItemGroup>
            <InfoItem label="Status" renderContent={renderTxStatus()} compact />
            <InfoItem
              label="Date"
              renderContent={formatDate(new Date(txDetails.timestamp * 1000))}
              compact
            />
          </InfoItemGroup>
          {/* Secondary */}
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem label="From" renderContent={txDetails.from} />
            <InfoItem label="To" renderContent={txDetails.to} />
            <InfoItem label="Transaction ID" renderContent={txDetails.tx} />
            <InfoItem
              label="Network Fee"
              renderContent={renderFeeInfo()}
              compact
            />
            {txDetails.nonce && (
              <InfoItem
                label="Nonce"
                renderContent={String(txDetails.nonce)}
                compact
              />
            )}
            {txDetails.confirmations && (
              <InfoItem
                label="Confirmations"
                renderContent={txDetails.confirmations}
                compact
              />
            )}
          </InfoItemGroup>
          {/* Tertiary */}
          {txDetails.swapInfo && (
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
          )}
        </Stack>
      </>
    );
  }, [
    renderAssetsChange,
    renderFeeInfo,
    renderTxStatus,
    resp.isLoading,
    txDetails,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={txDetails?.label.label} />
      <Page.Body>{renderHistoryDetails()}</Page.Body>
    </Page>
  );
}

export { HistoryDetails };
