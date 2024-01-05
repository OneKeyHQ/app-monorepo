import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Icon, ListItem } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
} from '@onekeyhq/shared/types/tx';

import { buildTxActionDirection } from '../../utils/txAction';

import { TxActionCommonT1 } from './TxActionCommon';

import type { ITxActionProps } from './types';

export function getTxActionTransferInfo(props: ITxActionProps) {
  const { action, accountAddress } = props;

  // send | receive
  let transferDirection = '';
  // from | to
  let transferTarget = '';
  // token value
  let transferValue = '';
  // token icon | NFT image
  let transferIcon = '';
  // token symbol | NFT name
  let transferSymbol = '';
  // token amount | NFT amount
  let transferAmount = '';
  let transferFrom = '';
  let transferTo = '';

  if (action.type === EDecodedTxActionType.NATIVE_TRANSFER) {
    const { nativeTransfer } = action;
    transferIcon = nativeTransfer?.tokenInfo.logoURI ?? '';
    transferAmount = nativeTransfer?.amount ?? '';
    transferSymbol = nativeTransfer?.tokenInfo.symbol ?? '';
    transferValue = new BigNumber(nativeTransfer?.tokenInfo.price ?? 0)
      .times(nativeTransfer?.amount ?? 0)
      .toFixed(2);
    transferFrom = nativeTransfer?.from ?? '';
    transferTo = nativeTransfer?.to ?? '';
  }

  if (action.type === EDecodedTxActionType.TOKEN_TRANSFER) {
    const { tokenTransfer } = action;
    transferIcon = tokenTransfer?.tokenInfo.logoURI ?? '';
    transferAmount = tokenTransfer?.amount ?? '';
    transferSymbol = tokenTransfer?.tokenInfo.symbol ?? '';
    transferValue = new BigNumber(tokenTransfer?.tokenInfo.price ?? 0)
      .times(tokenTransfer?.amount ?? 0)
      .toFixed(2);
    transferFrom = tokenTransfer?.from ?? '';
    transferTo = tokenTransfer?.to ?? '';
  }

  if (action.type === EDecodedTxActionType.NFT_TRANSFER) {
    const { nftTransfer } = action;
    transferIcon = action.nftTransfer?.nftInfo.metadata.image ?? '';
    transferAmount = nftTransfer?.amount ?? '';
    transferSymbol = nftTransfer?.nftInfo.metadata.name ?? '';
    transferFrom = action.nftTransfer?.from ?? '';
    transferTo = action.nftTransfer?.to ?? '';
  }

  transferDirection = buildTxActionDirection({
    from: transferFrom,
    to: transferTo,
    accountAddress,
  });

  if (transferDirection === EDecodedTxDirection.OUT) {
    transferTarget = transferTo;
  } else {
    transferTarget = transferFrom;
  }

  return {
    transferTarget,
    transferValue,
    transferIcon,
    transferDirection,
    transferSymbol,
    transferAmount,
  };
}

function TxActionTransferT0(props: ITxActionProps) {
  const intl = useIntl();
  const {
    transferIcon,
    transferTarget,
    transferValue,
    transferDirection,
    transferAmount,
    transferSymbol,
  } = getTxActionTransferInfo(props);

  let title = '';
  let subTitle = '';
  let content = '';
  if (transferDirection === EDecodedTxDirection.OUT) {
    title = intl.formatMessage({ id: 'action__send' });
    subTitle = `to: ${accountUtils.shortenAddress({
      address: transferTarget,
    })}`;
    content = `- ${transferAmount} ${transferSymbol}`;
  } else {
    title = intl.formatMessage({ id: 'action__receive' });
    subTitle = `from: ${accountUtils.shortenAddress({
      address: transferTarget,
    })}`;
    content = `+ ${transferAmount} ${transferSymbol}`;
  }
  return (
    <ListItem
      title={title}
      subtitle={subTitle}
      avatarProps={{
        src: transferIcon,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
    >
      <ListItem.Text
        align="right"
        primary={content}
        secondary={transferValue}
        secondaryTextProps={{ color: '$textSubdued' }}
      />
    </ListItem>
  );
}

function TxActionTransferT1(props: ITxActionProps) {
  const intl = useIntl();
  const {
    transferIcon,
    transferTarget,
    transferDirection,
    transferAmount,
    transferSymbol,
  } = getTxActionTransferInfo(props);

  let title = '';
  let content = '';
  let description = '';

  if (transferDirection === EDecodedTxDirection.OUT) {
    title = intl.formatMessage({ id: 'action__send' });
    content = `- ${transferAmount} ${transferSymbol}`;
    description = `To: ${transferTarget}`;
  } else {
    title = intl.formatMessage({ id: 'action__receive' });
    content = `+ ${transferAmount} ${transferSymbol}`;
    description = `From: ${transferTarget}`;
  }

  return (
    <TxActionCommonT1
      title={title}
      icon={transferIcon}
      content={content}
      description={description}
    />
  );
}

export { TxActionTransferT0, TxActionTransferT1 };
