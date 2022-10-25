import React, { FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  HStack,
  IconButton,
  Pressable,
  Token,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { ADDRESS_ZERO } from '@onekeyhq/engine/src/managers/revoke';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { SendRoutes } from '../../Send/types';
import { useSpenderAppName } from '../hooks';
import showAllowanceDetailOverlay, {
  ActionKey,
} from '../Overlays/AllowanceDetail';

type Props = {
  spender: string;
  token: TokenType;
  networkId: string;
  accountAddress: string;
  tokenId?: string;
  onRevokeSuccess: () => void;
};

export const ERC721Allowance: FC<Props> = ({
  networkId,
  accountAddress,
  token,
  spender,
  tokenId,
  onRevokeSuccess,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const name = useSpenderAppName(networkId, spender);
  const { account } = useActiveWalletAccount();
  const navigation = useNavigation();

  const isCurrentAccount = useMemo(
    () => account?.address.toLowerCase() === accountAddress.toLowerCase(),
    [account, accountAddress],
  );

  const label = useMemo(() => {
    if (!tokenId) {
      return intl.formatMessage({ id: 'form__unlimited_allowance' });
    }
    return `Allowance for token ID ${tokenId}`;
  }, [intl, tokenId]);

  const update = useCallback(async () => {
    if (!account) {
      return;
    }
    if (!networkId) {
      return;
    }
    const encodedApproveTx =
      tokenId === undefined
        ? await backgroundApiProxy.serviceRevoke.buildEncodedTxsFromSetApprovalForAll(
            {
              from: accountAddress,
              to: token.address ?? '',
              approved: false,
              spender,
            },
          )
        : await backgroundApiProxy.serviceRevoke.buildEncodedTxsFromApprove({
            from: accountAddress,
            to: token.address ?? '',
            approve: ADDRESS_ZERO,
            tokenId,
          });

    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendRoutes.SendConfirm,
        params: {
          accountId: account.id,
          networkId,
          feeInfoEditable: true,
          feeInfoUseFeeInTx: false,
          skipSaveHistory: false,
          encodedTx: encodedApproveTx,
          onSuccess: onRevokeSuccess,
        },
      },
    });
  }, [
    tokenId,
    spender,
    account,
    networkId,
    navigation,
    accountAddress,
    token,
    onRevokeSuccess,
  ]);

  const onRevoke = useCallback(() => {
    update();
  }, [update]);

  const buttons = useMemo(() => {
    if (!isCurrentAccount) {
      return null;
    }
    return (
      <HStack alignSelf="flex-end">
        <IconButton
          bg="action-secondary-default"
          size="xs"
          name="CloseSolid"
          iconSize={20}
          px="3"
          py="2"
          ml="2"
          onPress={onRevoke}
        />
      </HStack>
    );
  }, [onRevoke, isCurrentAccount]);

  const onDetailActionPress = useCallback(
    (key: ActionKey) => {
      switch (key) {
        case 'copy':
          copyToClipboard(spender);
          toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
          break;
        case 'revoke':
          onRevoke();
          break;
        default: {
          // pass
        }
      }
    },
    [spender, onRevoke, intl, toast],
  );

  const showRevokeDetail = useCallback(() => {
    showAllowanceDetailOverlay({
      spenderName: name,
      allowance: label,
      onActionPress: onDetailActionPress,
      disabledActions: isCurrentAccount ? ['change'] : ['change', 'revoke'],
    });
  }, [name, label, onDetailActionPress, isCurrentAccount]);

  return (
    <Pressable onPress={showRevokeDetail}>
      <HStack flex="1" mb="2">
        <Token
          token={{ name, symbol: label }}
          showInfo
          size={5}
          flex="1"
          infoBoxProps={{ flex: 1 }}
        />
        {buttons}
      </HStack>
    </Pressable>
  );
};
