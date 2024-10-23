import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  NumberSizeableText,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAccountData } from '../../hooks/useAccountData';
import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';
import {
  useSendConfirmActions,
  useTokenApproveInfoAtom,
} from '../../states/jotai/contexts/sendConfirm';
import { showApproveEditor } from '../../views/ApproveEditor';
import { AddressInfo } from '../AddressInfo';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

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
  } = getTxActionTokenApproveInfo(props);

  let title = approveLabel;
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    src: approveIcon,
  };
  const description = {
    children: accountUtils.shortenAddress({
      address: approveSpender,
    }),
  };

  if (!title) {
    if (new BigNumber(approveAmount).eq(0)) {
      title = intl.formatMessage(
        {
          id: ETranslations.global_revoke_approve,
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

  const changeDescription = (
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
      {approveIsMax
        ? intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_amount_un_limit,
          })
        : approveAmount}
    </NumberSizeableTextWrapper>
  );

  return (
    <TxActionCommonListView
      title={title}
      avatar={avatar}
      description={description}
      tableLayout={tableLayout}
      change={approveName}
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
  } = getTxActionTokenApproveInfo(props);

  const { vaultSettings } = useAccountData({
    networkId: decodedTx.networkId,
  });

  const { updateTokenApproveInfo } = useSendConfirmActions().current;
  const [tokenApproveInfo] = useTokenApproveInfoAtom();

  const handleResetApproveInfo = useCallback(() => {
    updateTokenApproveInfo({
      allowance: '',
      isUnlimited: false,
    });
  }, [updateTokenApproveInfo]);

  const handleChangeApproveInfo = useCallback(
    ({
      allowance,
      isUnlimited,
    }: {
      allowance: string;
      isUnlimited: boolean;
    }) => {
      updateTokenApproveInfo({
        allowance,
        isUnlimited,
      });
    },
    [updateTokenApproveInfo],
  );

  let content: React.ReactNode = approveLabel;
  let amount = originalApproveAmount;
  let isUnlimited = approveIsMax;
  if (tokenApproveInfo.allowance !== '' || !content) {
    if (tokenApproveInfo.allowance !== '') {
      amount = tokenApproveInfo.allowance;
      isUnlimited = tokenApproveInfo.isUnlimited;
    }

    if (new BigNumber(amount).eq(0)) {
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
    (approveIsMax || new BigNumber(originalApproveAmount).gt(0))
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
              onResetTokenApproveInfo: handleResetApproveInfo,
              onChangeTokenApproveInfo: handleChangeApproveInfo,
            })
          }
        >
          {intl.formatMessage({ id: ETranslations.global_edit })}
        </Button>
      </XStack>
    );
  }

  return (
    <TxActionCommonDetailView
      networkId={decodedTx.networkId}
      overview={{
        title: intl.formatMessage({ id: ETranslations.content__amount }),
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
