import { useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EApproveType } from '@onekeyhq/shared/types/tx';

import { useAccountData } from '../../hooks/useAccountData';
import { useTokenApproveAllowance } from '../../hooks/useTokenApproveAllowance';
import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';
import { useSendConfirmActions } from '../../states/jotai/contexts/sendConfirm';
import { showApproveEditor } from '../../views/ApproveEditor';
import { AddressInfo } from '../AddressInfo';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';
import { Token } from '../Token';

import {
  TxActionCommonDetailView,
  TxActionCommonListView,
} from './TxActionCommon';

import type { ITxActionCommonListViewProps, ITxActionProps } from './types';

function getTxActionTokenApproveInfo(props: ITxActionProps) {
  const { action } = props;
  const { tokenApprove } = action;
  const approveIcon = tokenApprove?.icon ?? '';
  const approveLabel = tokenApprove?.label ?? '';
  const approveAmount = tokenApprove?.amount ?? '';
  const approveName = tokenApprove?.name ?? '';
  const approveSymbol = tokenApprove?.symbol ?? '';
  const approveSpender = tokenApprove?.spender ?? '';
  const approveInteractWith = tokenApprove?.to ?? '';
  const approveOwner = tokenApprove?.from ?? '';
  const approveIsMax = tokenApprove?.isInfiniteAmount ?? false;
  const tokenAddress = tokenApprove?.tokenIdOnNetwork ?? '';
  const tokenDecimals = tokenApprove?.decimals ?? 0;
  const tokenSymbol = tokenApprove?.symbol ?? '';
  const approveType = tokenApprove?.approveType ?? EApproveType.Approve;

  return {
    approveIcon,
    approveAmount,
    approveName,
    approveSymbol,
    approveLabel,
    approveSpender,
    approveOwner,
    approveIsMax,
    approveInteractWith,
    tokenAddress,
    tokenDecimals,
    tokenSymbol,
    approveType,
  };
}

function TxActionTokenApproveListView(props: ITxActionProps) {
  const {
    tableLayout,
    decodedTx,
    componentProps,
    showIcon,
    replaceType,
    hideValue,
    compact,
  } = props;
  const intl = useIntl();
  const { txFee, txFeeFiatValue, txFeeSymbol, hideFeeInfo } =
    useFeeInfoInDecodedTx({
      decodedTx,
    });

  const {
    approveIcon,
    approveSpender,
    approveAmount,
    approveName,
    approveSymbol,
    approveIsMax,
    approveLabel,
    approveType,
  } = getTxActionTokenApproveInfo(props);

  const isIncrease =
    approveType === EApproveType.IncreaseAllowance ||
    approveType === EApproveType.IncreaseApproval;
  // increaseAllowance(MaxUint256) leaves "Infinite" in approveAmount even
  // though isInfiniteAmount is only set on absolute approve.
  const isIncreaseUnlimited =
    isIncrease && !new BigNumber(approveAmount).isFinite();
  const showUnlimitedAmount = approveIsMax || isIncreaseUnlimited;
  const isRevoke = !isIncrease && new BigNumber(approveAmount).eq(0);

  let title = approveLabel;
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    src: approveIcon,
  };
  if (tableLayout) {
    avatar.fallbackIcon = isRevoke
      ? 'ShieldCheckDoneOutline'
      : 'UnlockedOutline';
  }
  const description = {
    children: accountUtils.shortenAddress({
      address: approveSpender,
    }),
    originalAddress: approveSpender,
  };

  if (!title) {
    if (isRevoke) {
      title = intl.formatMessage(
        {
          id: ETranslations.global_revoke_approve,
        },
        {
          symbol: approveSymbol,
        },
      );
    } else if (isIncrease) {
      title = intl.formatMessage(
        {
          id: ETranslations.approve_edit_increase_allowance,
        },
        {
          symbol: approveSymbol,
        },
      );
    } else {
      title = intl.formatMessage({
        id: ETranslations.global_approve,
      });
    }
  }

  let change: React.ReactNode;
  let changeDescription: React.ReactNode;

  if (tableLayout) {
    if (isRevoke) {
      change = undefined;
    } else if (showUnlimitedAmount) {
      change = (
        <XStack gap="$1" alignItems="center">
          <Token size="xs" tokenImageUri={approveIcon} />
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.swap_page_provider_approve_amount_un_limit,
            })}{' '}
            {approveSymbol}
          </SizableText>
        </XStack>
      );
    } else {
      change = (
        <XStack gap="$1" alignItems="center">
          <Token size="xs" tokenImageUri={approveIcon} />
          {isIncrease ? <SizableText size="$bodyMd">+</SizableText> : null}
          <NumberSizeableTextWrapper
            hideValue={hideValue}
            formatter="balance"
            formatterOptions={{
              tokenSymbol: approveSymbol,
            }}
            size="$bodyMd"
            numberOfLines={1}
          >
            {approveAmount}
          </NumberSizeableTextWrapper>
        </XStack>
      );
    }
    // Don't pass changeDescription in tableLayout
  } else {
    change = approveName;
    if (showUnlimitedAmount) {
      changeDescription = (
        <NumberSizeableTextWrapper
          hideValue={hideValue}
          formatter="balance"
          formatterOptions={{
            tokenSymbol: approveSymbol,
          }}
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
        >
          {intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_amount_un_limit,
          })}
        </NumberSizeableTextWrapper>
      );
    } else if (isIncrease) {
      // "+" lives outside the formatter so BigNumber doesn't strip it.
      changeDescription = (
        <XStack gap="$0.5" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            +
          </SizableText>
          <NumberSizeableTextWrapper
            hideValue={hideValue}
            formatter="balance"
            formatterOptions={{
              tokenSymbol: approveSymbol,
            }}
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
          >
            {approveAmount}
          </NumberSizeableTextWrapper>
        </XStack>
      );
    } else {
      changeDescription = (
        <NumberSizeableTextWrapper
          hideValue={hideValue}
          formatter="balance"
          formatterOptions={{
            tokenSymbol: approveSymbol,
          }}
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
        >
          {approveAmount}
        </NumberSizeableTextWrapper>
      );
    }
  }

  return (
    <TxActionCommonListView
      title={title}
      avatar={avatar}
      description={description}
      tableLayout={tableLayout}
      change={change}
      changeDescription={changeDescription}
      fee={txFee}
      feeFiatValue={txFeeFiatValue}
      feeSymbol={txFeeSymbol}
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
      showIcon={showIcon}
      hideFeeInfo={hideFeeInfo}
      replaceType={replaceType}
      status={decodedTx.status}
      networkId={decodedTx.networkId}
      networkLogoURI={decodedTx.networkLogoURI}
      riskyLevel={decodedTx.riskyLevel}
      compact={compact}
      {...componentProps}
    />
  );
}

function TxActionTokenApproveDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const { decodedTx } = props;
  const {
    approveIcon,
    approveSpender,
    approveOwner,
    approveLabel,
    approveAmount: originalApproveAmount,
    approveSymbol,
    approveIsMax,
    approveInteractWith,
    tokenAddress,
    tokenDecimals,
    tokenSymbol,
    approveType,
  } = getTxActionTokenApproveInfo(props);

  const { vaultSettings } = useAccountData({
    networkId: decodedTx.networkId,
  });

  const { updateTokenApproveInfo } = useSendConfirmActions().current;
  const approveInfoInit = useRef(false);

  const isIncrease =
    approveType === EApproveType.IncreaseAllowance ||
    approveType === EApproveType.IncreaseApproval;

  // Same "Infinite" sentinel handling as the list view.
  const isIncreaseUnlimited =
    isIncrease && !new BigNumber(originalApproveAmount).isFinite();

  const { allowanceParsed: currentAllowanceParsed } = useTokenApproveAllowance({
    enabled: isIncrease,
    accountId: decodedTx.accountId,
    networkId: decodedTx.networkId,
    tokenAddress,
    spender: approveSpender,
  });

  const finalAllowanceParsed = useMemo(() => {
    if (!isIncrease || !currentAllowanceParsed) return null;
    const deltaBN = new BigNumber(originalApproveAmount);
    // null signals "unlimited" to the caller; finite delta is added.
    if (!deltaBN.isFinite()) return null;
    return new BigNumber(currentAllowanceParsed).plus(deltaBN).toFixed();
  }, [currentAllowanceParsed, isIncrease, originalApproveAmount]);

  let content: React.ReactNode = approveLabel;
  const amount = originalApproveAmount;
  const isUnlimited = approveIsMax;
  if (!content) {
    if (isIncrease) {
      if (isIncreaseUnlimited) {
        content = intl.formatMessage(
          { id: ETranslations.form__approve_str },
          {
            amount: intl.formatMessage({
              id: ETranslations.swap_page_provider_approve_amount_un_limit,
            }),
            symbol: approveSymbol,
          },
        );
      } else if (finalAllowanceParsed) {
        content = intl.formatMessage(
          { id: ETranslations.form__approve_str },
          { amount: finalAllowanceParsed, symbol: approveSymbol },
        );
      } else {
        content = intl.formatMessage(
          {
            id: ETranslations.approve_edit_increase_allowance_by_amount,
          },
          {
            symbol: approveSymbol,
            amount,
          },
        );
      }
    } else if (new BigNumber(amount).eq(0)) {
      content = intl.formatMessage(
        {
          id: ETranslations.global_revoke_approve,
        },
        {
          symbol: approveSymbol,
        },
      );
    } else {
      content = intl.formatMessage(
        { id: ETranslations.form__approve_str },
        {
          amount: isUnlimited
            ? intl.formatMessage({
                id: ETranslations.swap_page_provider_approve_amount_un_limit,
              })
            : amount,
          symbol: approveSymbol,
        },
      );
    }
  }

  if (
    vaultSettings?.editApproveAmountEnabled &&
    (approveIsMax ||
      isIncreaseUnlimited ||
      new BigNumber(originalApproveAmount).gt(0))
  ) {
    content = (
      <XStack
        gap="$2"
        alignContent="center"
        minWidth={0}
        maxWidth="$96"
        flex={1}
      >
        <SizableText
          maxWidth="90%"
          size="$bodyLgMedium"
          wordWrap="break-word"
          style={{
            wordBreak: 'break-all',
          }}
        >
          {content}
        </SizableText>
        <Button
          testID="tx-action-btn"
          size="small"
          variant="tertiary"
          onPress={() =>
            showApproveEditor({
              accountId: decodedTx.accountId,
              networkId: decodedTx.networkId,
              isUnlimited,
              allowance: amount,
              tokenDecimals,
              tokenSymbol,
              tokenAddress,
              approveInfo: decodedTx.approveInfo,
              approveType,
              spender: approveSpender,
              currentAllowanceParsed: currentAllowanceParsed ?? undefined,
            })
          }
        >
          {intl.formatMessage({ id: ETranslations.global_edit })}
        </Button>
      </XStack>
    );
  }

  useEffect(() => {
    if (approveInfoInit.current || originalApproveAmount === '') return;
    updateTokenApproveInfo({
      originalAllowance: originalApproveAmount,
      originalIsUnlimited: approveIsMax,
    });
    approveInfoInit.current = true;
  }, [updateTokenApproveInfo, originalApproveAmount, approveIsMax]);

  return (
    <TxActionCommonDetailView
      networkId={decodedTx.networkId}
      overview={{
        title: intl.formatMessage({
          id: ETranslations.global_estimated_results,
        }),
        content,
        avatar: {
          src: approveIcon,
        },
      }}
      target={{
        title: intl.formatMessage({ id: ETranslations.interact_with_contract }),
        content: approveInteractWith,
      }}
      applyFor={{
        content: approveSpender,
      }}
      source={{
        content: approveOwner,
        description: {
          content: (
            <AddressInfo
              address={approveOwner}
              networkId={decodedTx.networkId}
              accountId={decodedTx.accountId}
            />
          ),
        },
      }}
    />
  );
}

export { TxActionTokenApproveListView, TxActionTokenApproveDetailView };
