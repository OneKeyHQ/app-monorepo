import React, { FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  DialogManager,
  HStack,
  IconButton,
  Pressable,
  Typography,
  VStack,
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
import { navigationRef } from '../../../provider/NavigationProvider';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { useCreateExternalAccount } from '../../ExternalAccount/useCreateExternalAccount';
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

export const ApproveDialog = ({ onClose }: { onClose?: () => void }) => {
  const intl = useIntl();
  const { createExternalAccount } = useCreateExternalAccount({});
  return (
    <Dialog
      visible
      onClose={() => {
        if (onClose) {
          return onClose();
        }
        const inst =
          navigationRef.current?.getParent() || navigationRef.current;
        inst?.goBack();
      }}
      contentProps={{
        title: intl.formatMessage({
          id: 'modal__connect_wallet_to manage_token_approvals',
        }),
        content: intl.formatMessage({
          id: 'modal__connect_wallet_to manage_token_approvals_desc',
        }),
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__connect_wallet',
        secondaryActionTranslationId: 'action__cancel',
        onPrimaryActionPress: ({ onClose: close }) => {
          createExternalAccount();
          onClose?.();
          close?.();
        },
      }}
    />
  );
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
    () =>
      account?.id &&
      networkId &&
      account?.address.toLowerCase() === accountAddress.toLowerCase(),
    [account, accountAddress, networkId],
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
      label: `${intl.formatMessage({ id: 'form__allowance' })}: ${v} ${
        token.symbol
      }`,
    };
  }, [totalSupply, allowance, intl, token]);

  const checkAccount = useCallback(() => {
    if (!isCurrentAccount) {
      DialogManager.show({
        render: <ApproveDialog />,
      });
      return false;
    }
    return true;
  }, [isCurrentAccount]);

  const update = useCallback(
    async (amount: string) => {
      if (!account) {
        return;
      }
      if (!networkId) {
        return;
      }
      if (!checkAccount()) {
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
    [
      spender,
      account,
      networkId,
      navigation,
      token,
      onRevokeSuccess,
      checkAccount,
    ],
  );

  const onChangeAllowance = useCallback(() => {
    if (!checkAccount()) {
      return;
    }
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
  }, [name, spender, balance, token, update, value, checkAccount]);

  const onRevoke = useCallback(() => {
    update('0');
  }, [update]);

  const buttons = useMemo(
    () => (
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
    ),
    [onChangeAllowance, intl, onRevoke],
  );

  const rightContent = useMemo(() => {
    if (isVertical) {
      return buttons;
    }
    return (
      <HStack w="260px" alignSelf="flex-start">
        <VStack flex="1">
          {value === 'unlimited' ? (
            <Typography.Body2Strong>{label}</Typography.Body2Strong>
          ) : (
            <>
              <Typography.Body2Strong>
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
              </Typography.Body2Strong>
              <Typography.Body2Strong color="text-subdued">
                {label}
              </Typography.Body2Strong>
            </>
          )}
        </VStack>
        {buttons}
      </HStack>
    );
  }, [isVertical, buttons, balance, price, value, label]);

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
      <HStack flex="1" mb="2" alignItems="center">
        {isVertical ? (
          <VStack flex="1">
            <Typography.Body2Strong>{name}</Typography.Body2Strong>
            <Typography.Body2Strong color="text-subdued">
              {label}
            </Typography.Body2Strong>
          </VStack>
        ) : (
          <Typography.Body1Strong flex="1">{name}</Typography.Body1Strong>
        )}
        {rightContent}
      </HStack>
    </Pressable>
  );
};
