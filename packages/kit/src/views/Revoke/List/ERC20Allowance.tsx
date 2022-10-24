import React, { FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  HStack,
  IconButton,
  Pressable,
  Token,
  Typography,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { toFloat } from '@onekeyhq/engine/src/managers/revoke';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrencyNumber } from '../../../components/Format';
import { useActiveWalletAccount } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { SendRoutes } from '../../Send/types';
import { useSpenderAppName } from '../hooks';
import showAllowanceDetailOverlay, {
  ActionKey,
} from '../Overlays/AllowanceDetail';
import showChangeAllowanceOverlay from '../Overlays/ChangeAllowance';

type Props = {
  spender: string;
  token: TokenType;
  networkId: string;
  balance: B;
  price: string;
  allowance: string;
  totalSupply: string;
  accountAddress: string;
  onRevokeSuccess: () => void;
};

export const ERC20Allowance: FC<Props> = ({
  networkId,
  allowance,
  totalSupply,
  balance,
  price,
  accountAddress,
  token,
  spender,
  onRevokeSuccess,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const isVertical = useIsVerticalLayout();
  const name = useSpenderAppName(networkId, spender);
  const { account } = useActiveWalletAccount();
  const navigation = useNavigation();

  const isCurrentAccount = useMemo(
    () => account?.address.toLowerCase() === accountAddress.toLowerCase(),
    [account, accountAddress],
  );

  const { label, value } = useMemo(() => {
    if (!allowance || !totalSupply) {
      return { label: '', value: '0' };
    }
    const allowanceBN = new B(allowance);
    const totalSupplyBN = new B(totalSupply);

    if (allowanceBN.isGreaterThan(totalSupplyBN)) {
      return {
        label: intl.formatMessage({ id: 'form__unlimited_allowance' }),
        value: 'unlimited',
      };
    }

    const v = toFloat(allowanceBN.toNumber(), token.decimals);
    return {
      value: v,
      label: `${v} ${token.symbol}`,
    };
  }, [totalSupply, allowance, intl, token]);

  const update = useCallback(
    async (amount: string) => {
      if (!account) {
        return;
      }
      if (!networkId) {
        return;
      }
      const encodedApproveTx =
        await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          amount,
          networkId,
          spender,
          accountId: account.id,
          token: token.tokenIdOnNetwork,
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
            encodedTx: encodedApproveTx as IEncodedTxEvm,
            onSuccess: onRevokeSuccess,
          },
        },
      });
    },
    [spender, account, networkId, navigation, token, onRevokeSuccess],
  );

  const onChangeAllowance = useCallback(() => {
    showChangeAllowanceOverlay({
      dapp: {
        name,
      },
      spender,
      balance,
      symbol: token.symbol,
      allowance: value,
      update,
    });
  }, [name, spender, balance, token, update, value]);

  const onRevoke = useCallback(() => {
    update('0');
  }, [update]);

  const buttons = useMemo(() => {
    if (!isCurrentAccount) {
      return null;
    }
    return (
      <HStack alignSelf="flex-end">
        <Button
          size="xs"
          bg="action-secondary-default"
          px="3"
          py="2"
          onPress={onChangeAllowance}
        >
          <Typography.CaptionStrong>
            {intl.formatMessage({ id: 'action__change' })}
          </Typography.CaptionStrong>
        </Button>
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
  }, [onChangeAllowance, intl, onRevoke, isCurrentAccount]);

  const rightContent = useMemo(() => {
    if (isVertical) {
      return buttons;
    }
    return (
      <HStack w="260px" alignSelf="flex-start">
        <Typography.Body1Strong flex="1">
          {price ? (
            <FormatCurrencyNumber
              value={B.min(
                balance,
                value === 'unlimited' ? Infinity : value,
              ).multipliedBy(price)}
            />
          ) : (
            'N/A'
          )}
        </Typography.Body1Strong>
        {buttons}
      </HStack>
    );
  }, [isVertical, buttons, balance, price, value]);

  const onDetailActionPress = useCallback(
    (key: ActionKey) => {
      switch (key) {
        case 'copy':
          copyToClipboard(spender);
          toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
          break;
        case 'change':
          onChangeAllowance();
          break;
        case 'revoke':
          onRevoke();
          break;
        default: {
          // pass
        }
      }
    },
    [spender, onChangeAllowance, onRevoke, intl, toast],
  );

  const showRevokeDetail = useCallback(() => {
    showAllowanceDetailOverlay({
      spenderName: name,
      allowance: label,
      onActionPress: onDetailActionPress,
      disabledActions: isCurrentAccount ? [] : ['change', 'revoke'],
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
        {rightContent}
      </HStack>
    </Pressable>
  );
};
