import { useIntl } from 'react-intl';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';

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
  const approveIsMax = tokenApprove?.isMax ?? false;

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
  const { tableLayout, decodedTx, componentProps } = props;
  const intl = useIntl();
  const { txFee, txFeeFiatValue } = useFeeInfoInDecodedTx({ decodedTx });

  const {
    approveIcon,
    approveSpender,
    approveAmount,
    approveName,
    approveSymbol,
  } = getTxActionTokenApproveInfo(props);

  const title = intl.formatMessage({ id: 'title__approve' });
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    circular: true,
    src: approveIcon,
    fallbackIcon: 'ImageMountainSolid',
  };
  const description = {
    children: accountUtils.shortenAddress({
      address: approveSpender,
    }),
  };

  return (
    <TxActionCommonListView
      title={title}
      avatar={avatar}
      description={description}
      tableLayout={tableLayout}
      change={approveName}
      changeDescription={`${approveAmount} ${approveSymbol}`}
      fee={txFee}
      feeFiatValue={txFeeFiatValue}
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
      {...componentProps}
    />
  );
}

function TxActionTokenApproveDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const {
    approveIcon,
    approveSpender,
    approveOwner,
    approveLabel,
    approveAmount,
    approveSymbol,
  } = getTxActionTokenApproveInfo(props);

  const content =
    approveLabel ||
    intl.formatMessage(
      {
        id: 'form__approve_str',
      },
      {
        0: `${approveAmount} ${approveSymbol}`,
      },
    );

  return (
    <TxActionCommonDetailView
      overview={{
        title: intl.formatMessage({ id: 'content__amount' }),
        content,
        avatar: {
          src: approveIcon,
          circular: true,
        },
      }}
      target={{
        content: approveSpender,
      }}
      source={{ content: approveOwner }}
    />
  );
}

export { TxActionTokenApproveListView, TxActionTokenApproveDetailView };
