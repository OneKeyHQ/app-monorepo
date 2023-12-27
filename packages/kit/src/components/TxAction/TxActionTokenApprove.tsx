import { useIntl } from 'react-intl';

import { Icon, ListItem } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { TxActionCommonT1 } from './TxActionCommon';

import type { ITxActionProps } from './types';

function getTxActionTokenApproveInfo(props: ITxActionProps) {
  const { action } = props;
  const { tokenApprove } = action;
  const approveIcon = tokenApprove?.tokenInfo.logoURI ?? '';
  const approveAmount = tokenApprove?.amount ?? '';
  const approveSymbol = tokenApprove?.tokenInfo.symbol ?? '';
  const approveSpender = tokenApprove?.spender ?? '';

  return {
    approveIcon,
    approveAmount,
    approveSymbol,
    approveSpender,
  };
}

function TxActionTokenApproveT0(props: ITxActionProps) {
  const intl = useIntl();
  const { approveIcon, approveSpender, approveAmount, approveSymbol } =
    getTxActionTokenApproveInfo(props);

  const title = intl.formatMessage(
    { id: 'form__approve_str' },
    { 0: `${approveAmount} ${approveSymbol}` },
  );
  const subTitle = `to: ${accountUtils.shortenAddress({
    address: approveSpender,
  })}`;

  return (
    <ListItem
      title={title}
      subtitle={subTitle}
      avatarProps={{
        src: approveIcon,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
    />
  );
}

function TxActionTokenApproveT1(props: ITxActionProps) {
  const intl = useIntl();
  const { approveIcon, approveSpender, approveAmount, approveSymbol } =
    getTxActionTokenApproveInfo(props);

  const title = intl.formatMessage({ id: 'form__approved' });
  const content = `${approveAmount} ${approveSymbol}`;
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
