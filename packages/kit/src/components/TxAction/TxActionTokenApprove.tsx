import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { NumberSizeableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';
import { AddressInfo } from '../AddressInfo';

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
  };
}

function TxActionTokenApproveListView(props: ITxActionProps) {
  const { tableLayout, decodedTx, componentProps, showIcon, replaceType } =
    props;
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
    <NumberSizeableText
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
    </NumberSizeableText>
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
    approveAmount,
    approveSymbol,
    approveIsMax,
    approveInteractWith,
  } = getTxActionTokenApproveInfo(props);

  let content = approveLabel;
  if (!content) {
    if (new BigNumber(approveAmount).eq(0)) {
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
          amount: approveIsMax
            ? intl.formatMessage({
                id: ETranslations.swap_page_provider_approve_amount_un_limit,
              })
            : approveAmount,
          symbol: approveSymbol,
        },
      );
    }
  }

  return (
    <TxActionCommonDetailView
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
