import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  HStack,
  IconButton,
  Pressable,
  ToastManager,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { toFloat } from '@onekeyhq/engine/src/managers/revoke';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';

import { FormatCurrencyNumber } from '../../../components/Format';
import { navigationRef } from '../../../provider/NavigationProvider';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { showDialog } from '../../../utils/overlayUtils';
import { useConnectAndCreateExternalAccount } from '../../ExternalAccount/useConnectAndCreateExternalAccount';
import {
  useAccountCanTransaction,
  useSpenderAppName,
  useUpdateAllowance,
} from '../hooks';
import showAllowanceDetailOverlay from '../Overlays/AllowanceDetail';
import { AssetType, RevokeRoutes } from '../types';

import type { ActionKey } from '../Overlays/AllowanceDetail';

type Props = {
  spender: string;
  token: TokenType;
  networkId: string;
  balance: B;
  price: number | undefined;
  allowance: string;
  totalSupply: string;
  accountAddress: string;
};

export const ApproveDialog = ({ onClose }: { onClose?: () => void }) => {
  const intl = useIntl();
  const { connectAndCreateExternalAccount } =
    useConnectAndCreateExternalAccount();
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
          connectAndCreateExternalAccount();
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
}) => {
  const intl = useIntl();

  const isVertical = useIsVerticalLayout();
  const name = useSpenderAppName(networkId, spender);
  const navigation = useNavigation();

  const updateAllowance = useUpdateAllowance({
    networkId,
    spender,
    contract: token.tokenIdOnNetwork,
  });

  const hasPermission = useAccountCanTransaction(accountAddress);

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
    if (!hasPermission) {
      showDialog(<ApproveDialog />);
      return false;
    }
    return true;
  }, [hasPermission]);

  const update = useCallback(
    (amount: string) => {
      if (!checkAccount()) {
        return;
      }
      updateAllowance({
        amount,
        assetType: AssetType.tokens,
      });
    },
    [updateAllowance, checkAccount],
  );

  const onChangeAllowance = useCallback(() => {
    if (!checkAccount()) {
      return;
    }
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Revoke,
      params: {
        screen: RevokeRoutes.ChangeAllowance,
        params: {
          dapp: {
            spender,
            name,
          },
          balance: balance.toString(),
          token,
          allowance: value,
          networkId,
        },
      },
    });
  }, [
    networkId,
    name,
    spender,
    balance,
    token,
    value,
    checkAccount,
    navigation,
  ]);

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
          name="XMarkMini"
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
          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__copied' }),
          });
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
    [spender, onChangeAllowance, onRevoke, intl],
  );

  const showRevokeDetail = useCallback(() => {
    showAllowanceDetailOverlay({
      spenderName: name,
      allowance: label,
      onActionPress: onDetailActionPress,
      disabledActions: hasPermission ? [] : ['change', 'revoke'],
    });
  }, [name, label, onDetailActionPress, hasPermission]);

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
