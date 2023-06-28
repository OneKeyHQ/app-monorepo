import { useMemo } from 'react';

import { Box, Divider } from '@onekeyhq/components';
import { isNil } from 'lodash';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IDecodedTxActionTokenActivate } from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';

import { TxDetailStatusInfoBox } from './TxDetailStatusInfoBox';

import type { ITxActionListViewProps } from '../types';

function TxTopInfoBox(props: ITxActionListViewProps) {
  const { decodedTx, isSendConfirm } = props;

  const tokensInTx = useMemo(() => {
    const tokens: { [key: string]: Token } = {};
    const actions = decodedTx.outputActions ?? decodedTx.actions;

    actions.forEach((action) => {
      let tokensInfo: Array<Token | undefined> = [];
      switch (action.type) {
        case IDecodedTxActionType.NATIVE_TRANSFER:
          tokensInfo = [action.nativeTransfer?.tokenInfo];
          break;
        case IDecodedTxActionType.TOKEN_TRANSFER:
          tokensInfo = [action.tokenTransfer?.tokenInfo];
          break;
        case IDecodedTxActionType.TOKEN_APPROVE:
          tokensInfo = [action.tokenApprove?.tokenInfo];
          break;
        case IDecodedTxActionType.TOKEN_ACTIVATE: {
          const tokenActivate =
            action.tokenActivate as IDecodedTxActionTokenActivate;
          tokensInfo = [
            {
              ...tokenActivate,
              id: tokenActivate.tokenAddress,
              tokenIdOnNetwork: tokenActivate.tokenAddress,
              networkId: tokenActivate.networkId,
            },
          ];
          break;
        }

        case IDecodedTxActionType.INTERNAL_SWAP:
          tokensInfo = [
            action.internalSwap?.send.tokenInfo,
            action.internalSwap?.receive.tokenInfo,
          ];
          break;
        case IDecodedTxActionType.INTERNAL_STAKE:
          tokensInfo = [action.internalStake?.tokenInfo];
          break;
        default:
      }
      if (tokensInfo.length > 0) {
        tokensInfo
          .filter((token) => !isNil(token))
          .forEach((token) => (tokens[token!.id] = token!));
      }
    });
    return Object.values(tokens);
  }, [decodedTx.actions, decodedTx.outputActions]);

  if (isSendConfirm) return null;

  return (
    <Box mb={6}>
      <TxDetailStatusInfoBox tokensInTx={tokensInTx} {...props} />
      <Divider />
    </Box>
  );
}

export { TxTopInfoBox };
