import { useIntl } from 'react-intl';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { TxActionCommonT0, TxActionCommonT1 } from './TxActionCommon';

import type { ITxActionCommonProps, ITxActionProps } from './types';

function getTxActionTokenApproveInfo(props: ITxActionProps) {
  const { action } = props;
  const { tokenApprove } = action;
  const approveIcon = tokenApprove?.tokenIcon ?? '';
  const approveLabel = tokenApprove?.content ?? tokenApprove?.label ?? '';
  const approveAmount = tokenApprove?.amount ?? '';
  const approveSpender = tokenApprove?.spender ?? '';

  return {
    approveIcon,
    approveAmount,
    approveLabel,
    approveSpender,
  };
}

function TxActionTokenApproveT0(props: ITxActionProps) {
  const intl = useIntl();
  const { approveIcon, approveSpender, approveLabel } =
    getTxActionTokenApproveInfo(props);

  const title = approveLabel;
  const avatar: ITxActionCommonProps['avatar'] = {
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
    <TxActionCommonT0 title={title} avatar={avatar} description={description} />
  );
}

function TxActionTokenApproveT1(props: ITxActionProps) {
  const intl = useIntl();
  const { approveIcon, approveSpender, approveLabel } =
    getTxActionTokenApproveInfo(props);

  const title = intl.formatMessage({ id: 'form__approved' });
  const content = approveLabel;
  const description = `to: ${accountUtils.shortenAddress({
    address: approveSpender,
  })}`;

  return (
    <TxActionCommonT1
      title={title}
      icon={approveIcon}
      content={content}
      description={description}
    />
  );
}

export { TxActionTokenApproveT0, TxActionTokenApproveT1 };
