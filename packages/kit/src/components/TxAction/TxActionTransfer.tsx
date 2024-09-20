/* eslint-disable no-nested-ternary */
import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { forOwn, groupBy, isEmpty, isNil, map, uniq } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Divider,
  Image,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxDirection,
  EDecodedTxStatus,
  type IDecodedTxActionAssetTransfer,
  type IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';
import {
  InfoItem,
  InfoItemGroup,
} from '../../views/AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import { AddressInfo } from '../AddressInfo';
import { ListItem } from '../ListItem';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';
import { Token } from '../Token';

import { TxActionCommonListView } from './TxActionCommon';

import type { ITxActionCommonListViewProps, ITxActionProps } from './types';
import type { IntlShape } from 'react-intl';

type ITransferBlock = {
  target: string;
  transfersInfo: IDecodedTxTransferInfo[];
  direction: EDecodedTxDirection;
};

function getTxActionTransferInfo(
  props: ITxActionProps & { isUTXO?: boolean; intl: IntlShape },
) {
  const { action, decodedTx, isUTXO, intl } = props;

  const {
    from,
    to,
    sends,
    receives,
    label,
    application,
    isInternalStaking,
    internalStakingLabel,
  } = action.assetTransfer as IDecodedTxActionAssetTransfer;

  const { type } = decodedTx.payload ?? {};

  let transferTarget = '';

  const sendsWithNFT = sends.filter((send) => send.isNFT);
  const sendsWithToken = sends.filter((send) => !send.isNFT);
  const receivesWithToken = receives.filter((receive) => !receive.isNFT);
  const receivesWithNFT = receives.filter((receive) => receive.isNFT);

  const isSendToSelf =
    from &&
    to &&
    from === to &&
    !isEmpty(sends) &&
    sends[0]?.tokenIdOnNetwork === receives[0]?.tokenIdOnNetwork;

  if (!isEmpty(sends) && isEmpty(receives)) {
    const targets = uniq(map(sends, 'to'));
    if (targets.length === 1) {
      [transferTarget] = targets;
    } else {
      transferTarget = to;
    }
  } else if (isEmpty(sends) && !isEmpty(receives)) {
    const targets = uniq(map(receives, 'from'));
    if (targets.length === 1) {
      [transferTarget] = targets;
    } else {
      transferTarget = from;
    }
  } else if (isUTXO) {
    if (type === EOnChainHistoryTxType.Send) {
      const filteredReceives = receives.filter((receive) => !receive.isOwn);
      transferTarget =
        filteredReceives.length > 1
          ? intl.formatMessage(
              { id: ETranslations.global_count_addresses },
              { 'count': filteredReceives.length },
            )
          : filteredReceives[0]
          ? filteredReceives[0].to
          : receives[0].to;
    } else if (type === EOnChainHistoryTxType.Receive) {
      const filteredSends = sends.filter((send) => !send.isOwn);
      transferTarget =
        filteredSends.length > 1
          ? intl.formatMessage(
              { id: ETranslations.global_count_addresses },
              { 'count': filteredSends.length },
            )
          : filteredSends[0]
          ? filteredSends[0].from
          : sends[0].from;
    }
  } else {
    transferTarget = to;
  }

  return {
    sends,
    receives: isSendToSelf ? [] : receives,
    from,
    to,
    label: label ?? '',
    transferTarget,
    sendNFTIcon: sendsWithNFT[0]?.icon,
    receiveNFTIcon: receivesWithNFT[0]?.icon,
    sendTokenIcon: sendsWithToken[0]?.icon,
    receiveTokenIcon: receivesWithToken[0]?.icon,
    application,
    isInternalStaking,
    internalStakingLabel,
  };
}

function buildTransferChangeInfo({
  changePrefix,
  transfers,
  intl,
  nativeAmount,
  isUTXO,
}: {
  changePrefix: string;
  transfers: IDecodedTxTransferInfo[];
  intl: IntlShape;
  nativeAmount?: string;
  isUTXO?: boolean;
}) {
  let change = '';
  let changeSymbol = '';
  let changeDescription = '';

  if (isUTXO) {
    if (transfers.length > 1) {
      const tokens = uniq(map(transfers, 'tokenIdOnNetwork'));
      if (tokens.length > 1) {
        change = intl.formatMessage(
          { id: ETranslations.count_assets },
          {
            count: tokens.length,
          },
        );
        changeDescription = intl.formatMessage(
          { id: ETranslations.symbol_and_more },
          {
            symbol: transfers[0].symbol,
          },
        );
        return {
          change: `${changePrefix}${change}`,
          changeSymbol,
          changeDescription,
        };
      }
    }

    const amountBN = new BigNumber(nativeAmount ?? 0).abs();
    change = amountBN.toFixed();
    changeSymbol = transfers[0].symbol;
    changeDescription = isNil(transfers[0].price)
      ? ''
      : amountBN.multipliedBy(transfers[0].price).toFixed();
    return {
      change: `${changePrefix}${change}`,
      changeSymbol,
      changeDescription,
    };
  }

  if (transfers.length === 1) {
    if (transfers[0].amount) {
      const amountBN = new BigNumber(transfers[0].amount).abs();
      change = amountBN.toFixed();
      changeDescription = isNil(transfers[0].price)
        ? ''
        : amountBN.multipliedBy(transfers[0].price ?? 0).toFixed();
    }
    changeSymbol = transfers[0].isNFT ? transfers[0].name : transfers[0].symbol;
  } else {
    const tokens = uniq(map(transfers, 'tokenIdOnNetwork'));
    if (tokens.length === 1) {
      const totalAmountBN = transfers.reduce(
        (acc, transfer) => acc.plus(new BigNumber(transfer.amount).abs()),
        new BigNumber(0),
      );
      change = totalAmountBN.toFixed();
      changeSymbol = transfers[0].symbol;

      changeDescription = isNil(transfers[0].price)
        ? ''
        : totalAmountBN.multipliedBy(transfers[0].price ?? 0).toFixed();
    } else {
      const transfersWithNFT = transfers.filter((send) => send.isNFT);
      const transfersWithToken = transfers.filter((send) => !send.isNFT);
      if (transfersWithNFT.length === 0) {
        change = intl.formatMessage(
          { id: ETranslations.count_assets },
          {
            count: tokens.length,
          },
        );
        changeDescription = intl.formatMessage(
          { id: ETranslations.symbol_and_more },
          {
            symbol: transfersWithToken[0].symbol,
          },
        );
      } else if (transfersWithNFT.length === 1) {
        change = new BigNumber(transfersWithNFT[0].amount).abs().toFixed();
        changeSymbol = transfersWithNFT[0].name;
      } else {
        const totalNFTs = transfersWithNFT
          .reduce(
            (acc, transfer) => acc.plus(new BigNumber(transfer.amount).abs()),
            new BigNumber(0),
          )
          .toFixed();
        change = totalNFTs;
        changeSymbol = 'NFTs';
        changeDescription = intl.formatMessage(
          { id: ETranslations.symbol_and_more },
          {
            symbol: transfersWithNFT[0].name,
          },
        );
      }
    }
  }

  return {
    change: change ? `${changePrefix}${change}` : '',
    changeSymbol,
    changeDescription,
  };
}

function TxActionTransferListView(props: ITxActionProps) {
  const {
    tableLayout,
    decodedTx,
    componentProps,
    showIcon,
    replaceType,
    hideValue,
  } = props;
  const { networkId, payload, nativeAmount, actions, networkLogoURI } =
    decodedTx;
  const { type } = payload ?? {};
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const { txFee, txFeeFiatValue, txFeeSymbol, hideFeeInfo } =
    useFeeInfoInDecodedTx({
      decodedTx,
    });

  const { vaultSettings } = useAccountData({ networkId });

  const isUTXO = vaultSettings?.isUtxo;
  const isPending = decodedTx.status === EDecodedTxStatus.Pending;
  const {
    sends,
    receives,
    label,
    transferTarget,
    sendNFTIcon,
    sendTokenIcon,
    receiveNFTIcon,
    receiveTokenIcon,
  } = getTxActionTransferInfo({
    ...props,
    intl,
    isUTXO,
  });
  const description = {
    prefix: '',
    children: accountUtils.shortenAddress({
      address: transferTarget,
    }),
  };

  const avatar: ITxActionCommonListViewProps['avatar'] = {
    src: '',
    isNFT: !!(sendNFTIcon || receiveNFTIcon),
  };
  let title = '';
  let change: React.ReactNode = '';
  let changeSymbol = '';
  let changeDescription: React.ReactNode = '';
  let changeDescriptionSymbol = '';

  title = label;

  if (!isEmpty(sends) && isEmpty(receives)) {
    const changeInfo = buildTransferChangeInfo({
      changePrefix: '-',
      transfers: sends,
      intl,
    });
    change = changeInfo.change;
    changeSymbol = changeInfo.changeSymbol;
    changeDescription = changeInfo.changeDescription;
    avatar.src = sendNFTIcon || sendTokenIcon;
    title = intl.formatMessage({ id: ETranslations.global_send });
  } else if (isEmpty(sends) && !isEmpty(receives)) {
    const changeInfo = buildTransferChangeInfo({
      changePrefix: '+',
      transfers: receives,
      intl,
    });
    change = changeInfo.change;
    changeSymbol = changeInfo.changeSymbol;
    changeDescription = changeInfo.changeDescription;
    avatar.src = receiveNFTIcon || receiveTokenIcon;
    title = intl.formatMessage({ id: ETranslations.global_receive });
  } else if (vaultSettings?.isUtxo) {
    if (type === EOnChainHistoryTxType.Send) {
      const changeInfo = buildTransferChangeInfo({
        changePrefix: '-',
        transfers: sends,
        nativeAmount,
        intl,
        isUTXO,
      });
      change = changeInfo.change;
      changeSymbol = changeInfo.changeSymbol;
      changeDescription = changeInfo.changeDescription;
      avatar.src = sendTokenIcon;
      title = intl.formatMessage({ id: ETranslations.global_send });
    } else if (type === EOnChainHistoryTxType.Receive) {
      const changeInfo = buildTransferChangeInfo({
        changePrefix: '+',
        transfers: receives,
        nativeAmount,
        intl,
        isUTXO,
      });
      change = changeInfo.change;
      changeSymbol = changeInfo.changeSymbol;
      changeDescription = changeInfo.changeDescription;
      avatar.src = receiveTokenIcon;
      title = intl.formatMessage({ id: ETranslations.global_receive });
    }
  } else {
    const sendChangeInfo = buildTransferChangeInfo({
      changePrefix: '-',
      transfers: sends,
      intl,
    });
    const receiveChangeInfo = buildTransferChangeInfo({
      changePrefix: '+',
      transfers: receives,
      intl,
    });
    change = receiveChangeInfo.change;
    changeSymbol = receiveChangeInfo.changeSymbol;
    changeDescription = sendChangeInfo.change;
    changeDescriptionSymbol = sendChangeInfo.changeSymbol;
    avatar.src = [
      sendNFTIcon || sendTokenIcon,
      receiveNFTIcon || receiveTokenIcon,
    ].filter(Boolean);
  }

  change = change ? (
    <NumberSizeableTextWrapper
      hideValue={hideValue}
      formatter="balance"
      formatterOptions={{
        tokenSymbol: changeSymbol,
        showPlusMinusSigns: true,
      }}
      numberOfLines={1}
      size="$bodyLgMedium"
      {...((change as string)?.includes('+') && {
        color: '$textSuccess',
      })}
      {...(tableLayout && {
        size: '$bodyMdMedium',
      })}
    >
      {change as string}
    </NumberSizeableTextWrapper>
  ) : (
    <NumberSizeableTextWrapper
      size="$bodyLgMedium"
      formatter="value"
      hideValue={hideValue}
    >
      -
    </NumberSizeableTextWrapper>
  );
  changeDescription = changeDescription ? (
    <NumberSizeableTextWrapper
      hideValue={hideValue}
      formatter={changeDescriptionSymbol ? 'balance' : 'value'}
      formatterOptions={{
        tokenSymbol: changeDescriptionSymbol,
        currency: changeDescriptionSymbol ? '' : settings.currencyInfo.symbol,
        showPlusMinusSigns: !!changeDescriptionSymbol,
      }}
      size="$bodyMd"
      color="$textSubdued"
      numberOfLines={1}
      maxWidth="$40"
    >
      {changeDescription as string}
    </NumberSizeableTextWrapper>
  ) : (
    <NumberSizeableTextWrapper
      hideValue={hideValue}
      size="$bodyMd"
      color="$textSubdued"
      formatter="value"
    >
      -
    </NumberSizeableTextWrapper>
  );

  if (!isPending && label) {
    title = label;
  }

  if (!label && actions[0]?.assetTransfer?.isInternalSwap) {
    title = intl.formatMessage({ id: ETranslations.global_swap });
  }

  return (
    <TxActionCommonListView
      title={title}
      avatar={avatar}
      description={description}
      change={change}
      changeDescription={changeDescription}
      tableLayout={tableLayout}
      fee={txFee}
      feeFiatValue={txFeeFiatValue}
      feeSymbol={txFeeSymbol}
      hideFeeInfo={hideFeeInfo}
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
      showIcon={showIcon}
      replaceType={replaceType}
      status={decodedTx.status}
      networkId={networkId}
      networkLogoURI={networkLogoURI}
      {...componentProps}
    />
  );
}

function buildTransfersBlock(
  transferGroup: Record<string, IDecodedTxTransferInfo[]>,
  direction: EDecodedTxDirection,
) {
  const transfersBlock: ITransferBlock[] = [];
  forOwn(transferGroup, (transfers, target) => {
    const transfersInfo: IDecodedTxTransferInfo[] = [];
    const tokenGroup = groupBy(transfers, 'tokenIdOnNetwork');
    forOwn(tokenGroup, (tokens) => {
      const token = tokens[0];
      const tokensAmount = tokens.reduce(
        (acc, item) => acc.plus(item.amount),
        new BigNumber(0),
      );
      transfersInfo.push({
        ...token,
        amount: tokensAmount.toFixed(),
      });
    });
    transfersBlock.push({
      target,
      transfersInfo,
      direction,
    });
  });

  return transfersBlock;
}

function TxActionTransferDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const {
    decodedTx,
    nativeTokenTransferAmountToUpdate,
    isSendNativeToken,
    swapInfo,
  } = props;

  const { networkId } = decodedTx;

  const {
    sends,
    receives,
    from,
    to,
    application,
    isInternalStaking,
    internalStakingLabel,
  } = getTxActionTransferInfo({
    ...props,
    intl,
  });

  const { network: swapReceiveNetwork } = useAccountData({
    networkId: swapInfo?.receiver?.token?.networkId,
  });

  const { vaultSettings } = useAccountData({ networkId });

  const isUTXO = vaultSettings?.isUtxo;

  const sendsBlock = buildTransfersBlock(
    groupBy(sends, 'to'),
    EDecodedTxDirection.OUT,
  );
  const receivesBlock = buildTransfersBlock(
    groupBy(receives, 'from'),
    EDecodedTxDirection.IN,
  );

  const { network } = useAccountData({
    networkId: decodedTx.networkId,
  });

  const renderTransferBlock = useCallback(
    (transfersBlock: ITransferBlock[]) => {
      if (isEmpty(transfersBlock) && !isInternalStaking) return null;

      const transferOverviewElements: React.ReactElement[] = [];

      const transferChangeElements: React.ReactElement[] = [];

      const transferExtraElements: React.ReactElement[] = [];

      transfersBlock.forEach((block) => {
        const { transfersInfo } = block;
        transfersInfo.forEach((transfer) =>
          transferChangeElements.push(
            <ListItem key={transfer.tokenIdOnNetwork}>
              <Token isNFT={transfer.isNFT} tokenImageUri={transfer.icon} />
              <Stack flex={1}>
                <SizableText size="$bodyLgMedium">{`${
                  block.direction === EDecodedTxDirection.OUT ? '-' : '+'
                }${
                  isSendNativeToken &&
                  !isNil(nativeTokenTransferAmountToUpdate) &&
                  transfer.isNative &&
                  block.direction === EDecodedTxDirection.OUT &&
                  !isUTXO
                    ? nativeTokenTransferAmountToUpdate
                    : transfer.amount
                } ${
                  transfer.isNFT ? transfer.name : transfer.symbol
                }`}</SizableText>
                {/* <SizableText size="$bodyMd" color="$textSubdued">
              TODO: Fiat value
            </SizableText> */}
              </Stack>
            </ListItem>,
          ),
        );
      });

      const transfersContent = (
        <YStack py="$2.5">
          <XStack px="$5" pb="$2">
            {isInternalStaking && isEmpty(transfersBlock) ? null : (
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({ id: ETranslations.send_amount })}
              </SizableText>
            )}
            {swapInfo ? (
              <SizableText size="$bodyMd" color="$textSubdued" pl="$1.5">
                ({intl.formatMessage({ id: ETranslations.for_reference_only })})
              </SizableText>
            ) : null}
          </XStack>
          {isInternalStaking && isEmpty(transfersBlock) ? (
            <ListItem>
              <Token isNFT={false} fallbackIcon="Document2Outline" />
              <Stack flex={1}>
                <SizableText size="$bodyLgMedium">
                  {internalStakingLabel}
                </SizableText>
              </Stack>
            </ListItem>
          ) : (
            transferChangeElements
          )}
        </YStack>
      );
      transferOverviewElements.push(transfersContent);

      if (swapInfo) {
        transferExtraElements.push(
          ...[
            to ? (
              <InfoItem
                key="to"
                label={intl.formatMessage({
                  id: ETranslations.interact_with_contract,
                })}
                renderContent={to}
                description={
                  <AddressInfo
                    address={to}
                    networkId={decodedTx.networkId}
                    accountId={decodedTx.accountId}
                  />
                }
              />
            ) : null,
            <InfoItem
              key="pay-address"
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_pay_address,
              })}
              renderContent={swapInfo.accountAddress}
              description={
                <AddressInfo
                  address={swapInfo.accountAddress}
                  networkId={decodedTx.networkId}
                  accountId={decodedTx.accountId}
                />
              }
            />,
            <InfoItem
              key="received-address"
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_received_address,
              })}
              renderContent={swapInfo.receivingAddress}
              description={
                <AddressInfo
                  address={swapInfo.receivingAddress}
                  networkId={swapInfo.receiver.token.networkId}
                  accountId={decodedTx.accountId}
                />
              }
            />,
          ].filter(Boolean),
        );
      } else {
        transferExtraElements.push(
          ...[
            <InfoItem
              key="from"
              label={intl.formatMessage({ id: ETranslations.global_from })}
              renderContent={from}
              description={
                <AddressInfo
                  address={from}
                  networkId={decodedTx.networkId}
                  accountId={decodedTx.accountId}
                />
              }
            />,
            to ? (
              <InfoItem
                key="target"
                label={
                  application
                    ? intl.formatMessage({
                        id: ETranslations.interact_with_contract,
                      })
                    : intl.formatMessage({
                        id: ETranslations.global_to,
                      })
                }
                renderContent={
                  to || intl.formatMessage({ id: ETranslations.global_unknown })
                }
                description={
                  <AddressInfo
                    address={to}
                    networkId={decodedTx.networkId}
                    accountId={decodedTx.accountId}
                  />
                }
              />
            ) : null,
          ].filter(Boolean),
        );
      }

      let networkInfo: React.ReactElement | null = null;

      if (
        swapInfo &&
        swapReceiveNetwork?.id &&
        swapReceiveNetwork?.id !== network?.id
      ) {
        networkInfo = (
          <InfoItem
            compact
            label={intl.formatMessage({ id: ETranslations.network__network })}
            renderContent={
              <XStack alignItems="center" gap="$2">
                <XStack alignItems="center">
                  <Image w="$5" h="$5" source={{ uri: network?.logoURI }} />
                  <Stack
                    p="$0.5"
                    m="$-0.5"
                    ml="$-1"
                    borderRadius="$full"
                    bg="$bgApp"
                  >
                    <Image
                      w="$5"
                      h="$5"
                      source={{ uri: swapReceiveNetwork?.logoURI }}
                    />
                  </Stack>
                </XStack>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {network?.name} → {swapReceiveNetwork?.name}
                </SizableText>
              </XStack>
            }
          />
        );
      } else {
        networkInfo = (
          <InfoItem
            compact
            label={intl.formatMessage({ id: ETranslations.network__network })}
            renderContent={
              <XStack alignItems="center" gap="$2">
                <Image w="$5" h="$5" source={{ uri: network?.logoURI }} />
                <SizableText size="$bodyMd" color="$textSubdued">
                  {network?.name}
                </SizableText>
              </XStack>
            }
          />
        );
      }

      transferExtraElements.push(networkInfo);

      if (application) {
        transferExtraElements.push(
          <InfoItem
            compact
            label={intl.formatMessage({
              id: ETranslations.transaction_application,
            })}
            renderContent={
              <XStack alignItems="center" gap="$2">
                <Image
                  borderRadius="$1"
                  w="$5"
                  h="$5"
                  source={{ uri: application.icon }}
                />
                <SizableText size="$bodyMd" color="$textSubdued">
                  {application.name}
                </SizableText>
              </XStack>
            }
          />,
        );
      }

      return (
        <>
          <Stack testID="transfer-tx-amount">{transferOverviewElements}</Stack>
          <Divider mx="$5" />
          <InfoItemGroup testID="transfer-tx-action">
            {transferExtraElements}
          </InfoItemGroup>
        </>
      );
    },
    [
      application,
      decodedTx.accountId,
      decodedTx.networkId,
      from,
      internalStakingLabel,
      intl,
      isInternalStaking,
      isSendNativeToken,
      isUTXO,
      nativeTokenTransferAmountToUpdate,
      network?.id,
      network?.logoURI,
      network?.name,
      swapInfo,
      swapReceiveNetwork?.id,
      swapReceiveNetwork?.logoURI,
      swapReceiveNetwork?.name,
      to,
    ],
  );

  return <>{renderTransferBlock([...sendsBlock, ...receivesBlock])}</>;
}

export { TxActionTransferListView, TxActionTransferDetailView };
