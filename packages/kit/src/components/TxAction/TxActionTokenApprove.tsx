import { useIntl } from 'react-intl';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

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
  const approveSymbol = tokenApprove?.symbol ?? '';
  const approveSpender = tokenApprove?.to ?? '';
  const approveOwner = tokenApprove?.from ?? '';
  const approveIsMax = tokenApprove?.isMax ?? false;

  return {
    approveIcon,
    approveAmount,
    approveSymbol,
    approveLabel,
    approveSpender,
    approveOwner,
    approveIsMax,
  };
}

function TxActionTokenApproveListView(props: ITxActionProps) {
  const intl = useIntl();
  const { tableLayout } = props;
  const { approveIcon, approveSpender, approveLabel } =
    getTxActionTokenApproveInfo(props);

  const title = approveLabel;
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    circular: true,
    src: approveIcon,
    fallbackIcon: 'ImageMountainSolid',
  };
  const description = {
    prefix: intl.formatMessage({
      id: 'content__to',
    }),
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
    approveLabel ??
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
