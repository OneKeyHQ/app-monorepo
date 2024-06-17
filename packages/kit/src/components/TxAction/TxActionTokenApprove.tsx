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
  const approveSpender = tokenApprove?.to ?? '';
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
  };
}

function TxActionTokenApproveListView(props: ITxActionProps) {
  const { tableLayout, decodedTx, componentProps, showIcon } = props;
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
  } = getTxActionTokenApproveInfo(props);

  const title = intl.formatMessage({ id: ETranslations.global_approve });
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    src: approveIcon,
    fallbackIcon: 'ImageMountainSolid',
  };
  const description = {
    children: accountUtils.shortenAddress({
      address: approveSpender,
    }),
  };

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
      {approveIsMax ? 'Unlimited' : approveAmount}
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
  } = getTxActionTokenApproveInfo(props);

  const content =
    approveLabel || approveIsMax
      ? intl.formatMessage({
          id: ETranslations.swap_page_button_approve_unlimited,
        })
      : intl.formatMessage(
          { id: ETranslations.form__approve_str },
          {
            amount: approveAmount,
            symbol: approveSymbol,
          },
        );

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
        content: decodedTx.to ?? approveSpender,
      }}
      source={{
        content: approveOwner,
        description: {
          content: (
            <AddressInfo
              address={approveOwner}
              networkId={decodedTx.networkId}
            />
          ),
        },
      }}
    />
  );
}

export { TxActionTokenApproveListView, TxActionTokenApproveDetailView };
