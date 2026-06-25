/* eslint-disable no-nested-ternary */
import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { forOwn, groupBy, isEmpty, isNil, map, uniq } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
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
  type IDecodedTx,
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
import { NetworkAvatar } from '../NetworkAvatar';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';
import { Token } from '../Token';

import { MAX_DISPLAYED_TRANSFERS, formatTransferOverflowLabel } from './consts';
import { TxActionCommonListView } from './TxActionCommon';
import { TxActionSwapInfo } from './TxActionSwapInfo';

import type { ITxActionCommonListViewProps, ITxActionProps } from './types';
import type { IntlShape } from 'react-intl';

type ITransferBlock = {
  target: string;
  transfersInfo: IDecodedTxTransferInfo[];
  direction: EDecodedTxDirection;
};

type IPrivateSendCreateTokenAccountFee = {
  amount?: string;
  symbol?: string;
};

function isSendLikeHistoryTxType(type?: EOnChainHistoryTxType) {
  return (
    type === EOnChainHistoryTxType.Send ||
    type === EOnChainHistoryTxType.PrivateSend
  );
}

function getPrivateSendCreateTokenAccountFee(decodedTx: IDecodedTx) {
  const createTokenAccountFee = (
    decodedTx.extraInfo as
      | { createTokenAccountFee?: IPrivateSendCreateTokenAccountFee }
      | null
      | undefined
  )?.createTokenAccountFee;
  const feeAmountBN = new BigNumber(createTokenAccountFee?.amount ?? '');
  if (
    feeAmountBN.isNaN() ||
    !feeAmountBN.isFinite() ||
    !feeAmountBN.isGreaterThan(0)
  ) {
    return undefined;
  }
  return createTokenAccountFee;
}

function getPositiveNumberValue(value?: string) {
  const valueBN = new BigNumber(value ?? '');
  return valueBN.isNaN() || !valueBN.isFinite() || !valueBN.isGreaterThan(0)
    ? undefined
    : valueBN;
}

function getPrivateSendNativePriceFromFee(decodedTx: IDecodedTx) {
  const totalFeeInNativeBN = getPositiveNumberValue(decodedTx.totalFeeInNative);
  const totalFeeFiatValueBN = getPositiveNumberValue(
    decodedTx.totalFeeFiatValue,
  );
  if (!totalFeeInNativeBN || !totalFeeFiatValueBN) {
    return undefined;
  }

  return totalFeeFiatValueBN.div(totalFeeInNativeBN).toFixed();
}

function hasPrivateSendCreateTokenAccountFeeTransfer({
  transfers,
  createTokenAccountFee,
}: {
  transfers: IDecodedTxTransferInfo[];
  createTokenAccountFee: IPrivateSendCreateTokenAccountFee;
}) {
  return transfers.some((transfer) => {
    const amountBN = new BigNumber(transfer.amount ?? '');
    const feeAmountBN = new BigNumber(createTokenAccountFee.amount ?? '');
    return (
      transfer.isNative &&
      !amountBN.isNaN() &&
      !feeAmountBN.isNaN() &&
      amountBN.isEqualTo(feeAmountBN)
    );
  });
}

function buildPrivateSendDisplaySends({
  decodedTx,
  sends,
  networkLogoURI,
}: {
  decodedTx: IDecodedTx;
  sends: IDecodedTxTransferInfo[];
  networkLogoURI?: string;
}) {
  const createTokenAccountFee = getPrivateSendCreateTokenAccountFee(decodedTx);
  if (!createTokenAccountFee) {
    return sends;
  }
  if (
    hasPrivateSendCreateTokenAccountFeeTransfer({
      transfers: sends,
      createTokenAccountFee,
    })
  ) {
    return sends;
  }
  const nativePrice = getPrivateSendNativePriceFromFee(decodedTx);
  return [
    ...sends,
    {
      from: decodedTx.signer || decodedTx.owner,
      to: '',
      tokenIdOnNetwork: '',
      icon: networkLogoURI ?? '',
      name: createTokenAccountFee.symbol ?? '',
      symbol: createTokenAccountFee.symbol ?? '',
      amount: createTokenAccountFee.amount ?? '',
      isNFT: false,
      isNative: true,
      networkId: decodedTx.networkId,
      price: nativePrice,
    },
  ];
}

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

  // Drop EVM mint/burn sentinels (zero address) so protocol interactions
  // like Aave Borrow (debt-token mint) or wrap/burn flows don't end up with
  // an ambiguous endpoint set. The literal is harmless on non-EVM chains
  // (their addresses can't collide with this 20-byte hex form).
  const isZeroAddress = (addr?: string) =>
    !!addr &&
    addr.toLowerCase() === '0x0000000000000000000000000000000000000000';

  if (!isEmpty(sends) && isEmpty(receives)) {
    const targets = uniq(
      map(sends, 'to').filter((addr) => !isZeroAddress(addr)),
    );
    if (targets.length === 1) {
      [transferTarget] = targets;
    } else {
      transferTarget = to;
    }
  } else if (isEmpty(sends) && !isEmpty(receives)) {
    const targets = uniq(
      map(receives, 'from').filter((addr) => !isZeroAddress(addr)),
    );
    if (targets.length === 1) {
      [transferTarget] = targets;
    } else {
      // Fall back to the contract being interacted with (e.g. Aave Pool).
      // `from` here is the user's own address and never the right
      // counterparty in a receive-only tx; only use it if `to` is empty.
      transferTarget = to || from;
    }
  } else if (isUTXO) {
    if (isSendLikeHistoryTxType(type)) {
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

  if (transfers.length === 0) {
    return {
      change,
      changeSymbol,
      changeDescription,
    };
  }

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
            symbol: transfers[0]?.symbol ?? '',
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
    changeSymbol = transfers[0]?.symbol ?? '';
    changeDescription = isNil(transfers[0]?.price)
      ? ''
      : amountBN.multipliedBy(transfers[0]?.price ?? 0).toFixed();
    return {
      change: `${changePrefix}${change}`,
      changeSymbol,
      changeDescription,
    };
  }

  if (transfers.length === 1) {
    if (transfers[0].amount) {
      const amountBN = new BigNumber(transfers[0]?.amount ?? 0).abs();
      change = amountBN.toFixed();
      changeDescription = isNil(transfers[0]?.price)
        ? ''
        : amountBN.multipliedBy(transfers[0]?.price ?? 0).toFixed();
    }
    changeSymbol = transfers[0]?.isNFT
      ? (transfers[0]?.name ?? '')
      : (transfers[0]?.symbol ?? '');
  } else {
    const tokens = uniq(map(transfers, 'tokenIdOnNetwork'));
    if (tokens.length === 1) {
      const totalAmountBN = transfers.reduce(
        (acc, transfer) => acc.plus(new BigNumber(transfer.amount).abs()),
        new BigNumber(0),
      );
      change = totalAmountBN.toFixed();
      changeSymbol = transfers[0]?.symbol ?? '';

      changeDescription = isNil(transfers[0]?.price)
        ? ''
        : totalAmountBN.multipliedBy(transfers[0]?.price ?? 0).toFixed();
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
            symbol: transfersWithToken[0]?.symbol ?? '',
          },
        );
      } else if (transfersWithNFT.length === 1) {
        change = new BigNumber(transfersWithNFT[0]?.amount ?? 0)
          .abs()
          .toFixed();
        changeSymbol = transfersWithNFT[0]?.name ?? '';
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
            symbol: transfersWithNFT[0]?.name ?? '',
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

function groupTransfersByToken(transfers: IDecodedTxTransferInfo[]) {
  const tokenGroup = groupBy(transfers, 'tokenIdOnNetwork');
  return Object.values(tokenGroup).map((tokens) => ({
    ...tokens[0],
    amount: tokens
      .reduce(
        (acc, t) => acc.plus(new BigNumber(t.amount).abs()),
        new BigNumber(0),
      )
      .toFixed(),
  }));
}

function buildExpandedTransferView({
  sends = [],
  receives = [],
  hideValue,
  currencySymbol,
  intl,
}: {
  sends?: IDecodedTxTransferInfo[];
  receives?: IDecodedTxTransferInfo[];
  hideValue?: boolean;
  currencySymbol?: string;
  intl: IntlShape;
}) {
  // INVARIANT: each transfer line is a single fixed-height row — the token icon
  // (xs) and the amount/fiat texts share one horizontal XStack and are all
  // numberOfLines={1}, so a line never wraps. TxHistoryListView relies on this
  // (CHANGE_LINE_HEIGHT) to pin an exact fast-path row height without
  // CellMeasurer. If you make a line wrap or stack vertically, update
  // CHANGE_LINE_HEIGHT in TxHistoryListView/index.tsx accordingly.
  const renderTransferLine = (
    transfer: IDecodedTxTransferInfo,
    prefix: string,
    color: string,
  ) => {
    const amountBN = new BigNumber(transfer.amount).abs();
    const fiatValue =
      !isNil(transfer.price) && currencySymbol
        ? amountBN.multipliedBy(transfer.price ?? 0).toFixed()
        : null;
    return (
      <XStack
        key={`${prefix}-${transfer.tokenIdOnNetwork}`}
        alignItems="center"
        gap="$1"
      >
        <Token size="xs" isNFT={transfer.isNFT} tokenImageUri={transfer.icon} />
        <NumberSizeableTextWrapper
          hideValue={hideValue}
          formatter="balance"
          formatterOptions={{
            tokenSymbol: transfer.isNFT ? transfer.name : transfer.symbol,
            showPlusMinusSigns: true,
          }}
          numberOfLines={1}
          size="$bodyMd"
          color={color}
        >
          {`${prefix === 'r' ? '+' : '-'}${transfer.amount}`}
        </NumberSizeableTextWrapper>
        {fiatValue ? (
          <NumberSizeableTextWrapper
            hideValue={hideValue}
            formatter="value"
            formatterOptions={{ currency: currencySymbol }}
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
          >
            {fiatValue}
          </NumberSizeableTextWrapper>
        ) : null}
      </XStack>
    );
  };

  // Cap the rendered lines for the whole tx (receives + sends combined). A tx
  // that moves many assets at once (e.g. thousands of NFTs) would otherwise
  // render one line per transfer and freeze the UI. Slice the data to the first
  // MAX_DISPLAYED_TRANSFERS *before* mapping so we never build the thousands of
  // throwaway rows, and show a single "+N" overflow line for the rest.
  // getTransferChangeLineCount in TxHistoryListView mirrors this cap so the row
  // height stays bounded.
  // Order sends before receives to match the detail page (transfersToRender),
  // so the cap hides the same items on the list row and the detail page.
  const combinedTransfers = [...sends, ...receives];
  // Only collapse into a "+N" row when it hides 2+ transfers — showing a single
  // trailing transfer is cheaper than a "+1" row that hides it, and it keeps the
  // overflow count >= 2 so the plural-only "+N assets" label stays grammatically
  // correct. Rendered lines stay min(total, MAX_DISPLAYED_TRANSFERS + 1) either
  // way, which getTransferChangeLineCount mirrors for the row height.
  const visibleCount =
    combinedTransfers.length > MAX_DISPLAYED_TRANSFERS + 1
      ? MAX_DISPLAYED_TRANSFERS
      : combinedTransfers.length;
  const overflowTransfers = combinedTransfers.slice(visibleCount);
  const overflowCount = overflowTransfers.length;
  // Match the overflow chip's corner to what it summarizes: NFT images use a
  // rounded square ($2), fungible tokens use a circle ($full).
  const overflowIsNFT =
    overflowCount > 0 && overflowTransfers.every((t) => t.isNFT);

  return (
    <>
      {combinedTransfers
        .slice(0, visibleCount)
        .map((t, index) =>
          index < sends.length
            ? renderTransferLine(t, 's', '$text')
            : renderTransferLine(t, 'r', '$textSuccess'),
        )}
      {overflowCount > 0 ? (
        <XStack key="transfer-overflow" alignItems="center" gap="$1">
          <Stack
            w="$5"
            h="$5"
            borderRadius={overflowIsNFT ? '$2' : '$full'}
            bg="$bgStrong"
            justifyContent="center"
            alignItems="center"
          >
            <Icon name="DotHorOutline" size="$4" color="$iconSubdued" />
          </Stack>
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {formatTransferOverflowLabel({
              count: overflowCount,
              isNFT: overflowIsNFT,
              intl,
            })}
          </SizableText>
        </XStack>
      ) : null}
    </>
  );
}

function TxActionTransferListView(props: ITxActionProps) {
  const {
    tableLayout,
    decodedTx,
    componentProps,
    showIcon,
    replaceType,
    displayStatus,
    hideValue,
    compact,
  } = props;
  const { networkId, payload, nativeAmount, actions, networkLogoURI } =
    decodedTx;
  const { type } = payload ?? {};
  const isPrivateSend = type === EOnChainHistoryTxType.PrivateSend;
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
  const privateSendDisplaySends = isPrivateSend
    ? buildPrivateSendDisplaySends({
        decodedTx,
        sends,
        networkLogoURI,
      })
    : sends;
  const isSendLikeHistory = isSendLikeHistoryTxType(type);
  const descriptionTarget = isPrivateSend
    ? (payload?.privateSend?.originalRecipient ?? '')
    : transferTarget;
  const description = {
    prefix: '',
    children: accountUtils.shortenAddress({
      address: descriptionTarget,
    }),
    originalAddress: descriptionTarget,
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

  if (tableLayout) {
    const currencySymbol = settings.currencyInfo.symbol;

    if (isPrivateSend) {
      change = buildExpandedTransferView({
        intl,
        sends: groupTransfersByToken(privateSendDisplaySends),
        hideValue,
        currencySymbol,
      });
      avatar.fallbackIcon = 'ArrowTopOutline';
      title = intl.formatMessage({
        id: ETranslations.private_send_private_send,
      });
    } else if (!isEmpty(sends) && isEmpty(receives)) {
      change = buildExpandedTransferView({
        intl,
        sends: groupTransfersByToken(sends),
        hideValue,
        currencySymbol,
      });
      avatar.fallbackIcon = 'ArrowTopOutline';
      title = intl.formatMessage({ id: ETranslations.global_send });
    } else if (isEmpty(sends) && !isEmpty(receives)) {
      change = buildExpandedTransferView({
        intl,
        receives: groupTransfersByToken(receives),
        hideValue,
        currencySymbol,
      });
      avatar.fallbackIcon = 'ArrowBottomOutline';
      title = intl.formatMessage({ id: ETranslations.global_receive });
    } else if (vaultSettings?.isUtxo) {
      if (isSendLikeHistory) {
        const tokens = uniq(map(sends, 'tokenIdOnNetwork'));
        if (tokens.length > 1) {
          change = buildExpandedTransferView({
            intl,
            sends: groupTransfersByToken(sends),
            hideValue,
            currencySymbol,
          });
        } else {
          const amountBN = new BigNumber(nativeAmount ?? 0).abs();
          change = buildExpandedTransferView({
            intl,
            sends: [{ ...sends[0], amount: amountBN.toFixed() }],
            hideValue,
            currencySymbol,
          });
        }
        avatar.fallbackIcon = 'ArrowTopOutline';
        title = intl.formatMessage({ id: ETranslations.global_send });
      } else if (type === EOnChainHistoryTxType.Receive) {
        const tokens = uniq(map(receives, 'tokenIdOnNetwork'));
        if (tokens.length > 1) {
          change = buildExpandedTransferView({
            intl,
            receives: groupTransfersByToken(receives),
            hideValue,
            currencySymbol,
          });
        } else {
          const amountBN = new BigNumber(nativeAmount ?? 0).abs();
          change = buildExpandedTransferView({
            intl,
            receives: [{ ...receives[0], amount: amountBN.toFixed() }],
            hideValue,
            currencySymbol,
          });
        }
        avatar.fallbackIcon = 'ArrowBottomOutline';
        title = intl.formatMessage({ id: ETranslations.global_receive });
      }
    } else {
      change = buildExpandedTransferView({
        intl,
        sends: groupTransfersByToken(sends),
        receives: groupTransfersByToken(receives),
        hideValue,
        currencySymbol,
      });
      avatar.fallbackIcon = 'Document2Outline';
    }

    // swap / staking icon overrides
    if (!isPrivateSend && actions[0]?.assetTransfer?.isInternalSwap) {
      avatar.fallbackIcon = 'SwitchHorOutline';
    } else if (!isPrivateSend && actions[0]?.assetTransfer?.isInternalStaking) {
      avatar.fallbackIcon = 'CoinsOutline';
    }

    changeDescription = null;
  } else {
    const isStackedLayout = !tableLayout;
    if (isPrivateSend) {
      const changeInfo = buildTransferChangeInfo({
        changePrefix: '-',
        transfers: privateSendDisplaySends,
        intl,
      });
      change = changeInfo.change;
      changeSymbol = changeInfo.changeSymbol;
      changeDescription = changeInfo.changeDescription;
      avatar.src = sendNFTIcon || sendTokenIcon;
      title = intl.formatMessage({
        id: ETranslations.private_send_private_send,
      });
    } else if (!isEmpty(sends) && isEmpty(receives)) {
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
      if (isSendLikeHistory) {
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
        {...(isStackedLayout && {
          minWidth: 0,
          maxWidth: '100%',
          textAlign: 'right',
          flexShrink: 1,
        })}
        {...((change as string)?.includes('+') && {
          color: '$textSuccess',
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
        maxWidth={isStackedLayout ? '100%' : '$40'}
        {...(isStackedLayout && {
          minWidth: 0,
          textAlign: 'right',
          flexShrink: 1,
        })}
      >
        {changeDescription as string}
      </NumberSizeableTextWrapper>
    ) : (
      <NumberSizeableTextWrapper
        hideValue={hideValue}
        size="$bodyMd"
        color="$textSubdued"
        formatter="value"
        {...(isStackedLayout && {
          minWidth: 0,
          maxWidth: '100%',
          textAlign: 'right',
          flexShrink: 1,
        })}
      >
        -
      </NumberSizeableTextWrapper>
    );
  }

  if (isPrivateSend) {
    title = intl.formatMessage({
      id: ETranslations.private_send_private_send,
    });
  } else if (!isPending && label) {
    title = label;
  }

  if (!label && actions[0]?.assetTransfer?.isInternalSwap) {
    title = intl.formatMessage({ id: ETranslations.global_swap });
  } else if (!label && actions[0]?.assetTransfer?.isInternalStaking) {
    title = actions[0]?.assetTransfer?.internalStakingLabel ?? '';
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
      status={displayStatus ?? decodedTx.status}
      networkId={networkId}
      networkLogoURI={networkLogoURI}
      riskyLevel={decodedTx.riskyLevel}
      kytRiskLevel={
        // Hide the KYT risk badge for watch-only accounts.
        accountUtils.isWatchingAccount({ accountId: decodedTx.accountId })
          ? undefined
          : decodedTx.kytRiskLevel
      }
      compact={compact}
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

      if (swapInfo?.swapRequiredApproves) {
        swapInfo.swapRequiredApproves.forEach((approve) => {
          let approveContent = '';
          if (new BigNumber(approve.amount).eq(0)) {
            approveContent = intl.formatMessage(
              {
                id: ETranslations.global_revoke_approve,
              },
              {
                symbol: approve.symbol,
              },
            );
          } else {
            approveContent = intl.formatMessage(
              { id: ETranslations.form__approve_str },
              {
                amount: approve.isInfiniteAmount
                  ? intl.formatMessage({
                      id: ETranslations.swap_page_provider_approve_amount_un_limit,
                    })
                  : approve.amount,
                symbol: approve.symbol,
              },
            );
          }

          transferChangeElements.push(
            <ListItem key={`${approve.tokenIdOnNetwork}-approve`}>
              <Token
                isNFT={false}
                showNetworkIcon
                networkId={swapInfo.sender.accountInfo.networkId}
                tokenImageUri={approve.icon}
              />
              <Stack flex={1}>
                <SizableText size="$bodyLgMedium">{approveContent}</SizableText>
              </Stack>
            </ListItem>,
          );
        });
      }
      transfersBlock.forEach((block) => {
        const { transfersInfo } = block;
        transfersInfo.forEach((transfer) =>
          transferChangeElements.push(
            <ListItem key={transfer.tokenIdOnNetwork}>
              <Token
                isNFT={transfer.isNFT}
                tokenImageUri={transfer.icon}
                showNetworkIcon
                networkId={transfer.networkId}
              />
              <Stack flex={1}>
                <SizableText size="$bodyLgMedium">{`${
                  block.direction === EDecodedTxDirection.OUT ? '-' : '+'
                }${
                  isSendNativeToken &&
                  !isNil(nativeTokenTransferAmountToUpdate) &&
                  transfer.isNative &&
                  block.direction === EDecodedTxDirection.OUT
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
          <XStack px="$5" pb="$1">
            {isInternalStaking && isEmpty(transfersBlock) ? null : (
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.global_estimated_results,
                })}
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

      if (!swapInfo) {
        networkInfo = (
          <InfoItem
            compact
            label={intl.formatMessage({ id: ETranslations.network__network })}
            renderContent={
              <XStack alignItems="center" gap="$2">
                <NetworkAvatar networkId={network?.id} size="$5" />
                <SizableText size="$bodyMd" color="$textSubdued">
                  {network?.name}
                </SizableText>
              </XStack>
            }
          />
        );
      }

      if (networkInfo) {
        transferExtraElements.push(networkInfo);
      }

      return (
        <>
          <Stack testID="transfer-tx-amount">{transferOverviewElements}</Stack>
          <Divider mx="$5" />
          <InfoItemGroup testID="transfer-tx-action">
            {transferExtraElements}
          </InfoItemGroup>
          {swapInfo ? (
            <>
              <Divider mx="$5" />
              <TxActionSwapInfo swapInfo={swapInfo} />
            </>
          ) : null}
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
      nativeTokenTransferAmountToUpdate,
      network?.id,
      network?.name,
      swapInfo,
      to,
    ],
  );

  return <>{renderTransferBlock([...sendsBlock, ...receivesBlock])}</>;
}

export { TxActionTransferListView, TxActionTransferDetailView };
