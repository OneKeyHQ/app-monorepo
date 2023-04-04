import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  IconButton,
  Pressable,
  ToastManager,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';

import { useActiveWalletAccount } from '../../../hooks';
import { showDialog } from '../../../utils/overlayUtils';
import {
  useAccountCanTransaction,
  useSpenderAppName,
  useUpdateAllowance,
} from '../hooks';
import showAllowanceDetailOverlay from '../Overlays/AllowanceDetail';
import { AssetType } from '../types';

import { ApproveDialog } from './ERC20Allowance';

import type { ActionKey } from '../Overlays/AllowanceDetail';

type Props = {
  spender: string;
  token: TokenType;
  networkId: string;
  accountAddress: string;
  tokenId?: string;
};

export const ERC721Allowance: FC<Props> = ({
  networkId,
  accountAddress,
  token,
  spender,
  tokenId,
}) => {
  const intl = useIntl();

  const isVertical = useIsVerticalLayout();
  const name = useSpenderAppName(networkId, spender);
  const { account } = useActiveWalletAccount();

  const updateAllowance = useUpdateAllowance({
    networkId,
    spender,
    contract: token.tokenIdOnNetwork,
  });

  const hasPermission = useAccountCanTransaction(accountAddress);

  const label = useMemo(() => {
    if (!tokenId) {
      return intl.formatMessage({ id: 'form__unlimited_allowance' });
    }
    return `Allowance for token ID ${tokenId}`;
  }, [intl, tokenId]);

  const checkIsCurrentAccount = useCallback(() => {
    if (!hasPermission) {
      showDialog(<ApproveDialog />);
      return false;
    }
    return true;
  }, [hasPermission]);

  const update = useCallback(() => {
    if (!checkIsCurrentAccount()) {
      return;
    }
    if (!account?.id) {
      return;
    }
    updateAllowance({
      amount: '0',
      tokenId,
      assetType: AssetType.nfts,
    });
  }, [updateAllowance, checkIsCurrentAccount, tokenId, account]);

  const onRevoke = useCallback(() => {
    if (!checkIsCurrentAccount()) {
      return;
    }
    update();
  }, [update, checkIsCurrentAccount]);

  const buttons = useMemo(
    () => (
      <HStack alignSelf="flex-end">
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
    [onRevoke],
  );

  const rightContent = useMemo(() => {
    if (isVertical) {
      return buttons;
    }
    return (
      <HStack w="260px" alignSelf="flex-start">
        <VStack flex="1">
          <Typography.Body2Strong>{label}</Typography.Body2Strong>
        </VStack>
        {buttons}
      </HStack>
    );
  }, [isVertical, buttons, label]);

  const onDetailActionPress = useCallback(
    (key: ActionKey) => {
      switch (key) {
        case 'copy':
          copyToClipboard(spender);
          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__copied' }),
          });
          break;
        case 'revoke':
          onRevoke();
          break;
        default: {
          // pass
        }
      }
    },
    [spender, onRevoke, intl],
  );

  const showRevokeDetail = useCallback(() => {
    showAllowanceDetailOverlay({
      spenderName: name,
      allowance: label,
      onActionPress: onDetailActionPress,
      disabledActions: hasPermission ? ['change'] : ['change', 'revoke'],
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
