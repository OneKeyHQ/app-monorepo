import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { TouchableWithoutFeedback } from 'react-native';

import {
  Button,
  HStack,
  IconButton,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components';

import BaseMenu from '../../Overlay/BaseMenu';

type Props = {
  onPressSend: () => void;
  onPressReceive: () => void;
  onPressTransfer: () => void;
  style?: ComponentProps<typeof HStack>;
  balanceWithoutRecycle: {
    balance: string;
    availableBalance: string;
    transferBalance: string;
  };
  isWatching: boolean;
};

function TokenActions(props: Props) {
  const {
    onPressSend,
    onPressReceive,
    onPressTransfer,
    style,
    balanceWithoutRecycle,
    isWatching,
  } = props;

  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  const isInsufficientTransferBalance = useMemo(
    () =>
      new BigNumber(
        balanceWithoutRecycle.transferBalance ?? 0,
      ).isLessThanOrEqualTo(0),
    [balanceWithoutRecycle.transferBalance],
  );

  const isInsufficientAvailableBalance = useMemo(
    () =>
      new BigNumber(
        balanceWithoutRecycle.availableBalance ?? 0,
      ).isLessThanOrEqualTo(0),
    [balanceWithoutRecycle.availableBalance],
  );

  const isSendActionDisabled = useMemo(
    () =>
      (isInsufficientAvailableBalance && isInsufficientTransferBalance) ||
      isWatching,
    [isInsufficientAvailableBalance, isInsufficientTransferBalance, isWatching],
  );

  const isTransferActionDisabled = useMemo(
    () => isInsufficientAvailableBalance || isWatching,
    [isInsufficientAvailableBalance, isWatching],
  );

  const actions = useMemo(
    () => [
      {
        id: 'action__send',
        onPress: onPressSend,
        icon: 'PaperAirplaneOutline',
        isDisabled: isSendActionDisabled,
      },
      {
        id: 'action__receive',
        onPress: onPressReceive,
        icon: 'QrCodeMini',
        isDisabled: isWatching,
      },
      {
        id: 'action__transfer_brc20',
        onPress: onPressTransfer,
        icon: 'ArrowUturnDownMini',
        isDisabled: isTransferActionDisabled,
      },
    ],
    [
      isSendActionDisabled,
      isTransferActionDisabled,
      isWatching,
      onPressReceive,
      onPressSend,
      onPressTransfer,
    ],
  );

  if (isVertical) {
    return (
      <HStack space={2} {...style}>
        <Button
          size="lg"
          onPress={onPressSend}
          flex={1}
          isDisabled={isSendActionDisabled}
        >
          {intl.formatMessage({ id: 'action__send' })}
        </Button>
        <Button
          size="lg"
          onPress={onPressReceive}
          flex={1}
          isDisabled={isWatching}
        >
          {intl.formatMessage({ id: 'action__receive' })}
        </Button>
        <BaseMenu
          options={[
            {
              id: 'action__transfer_brc20',
              onPress: onPressTransfer,
              icon: 'ArrowUturnDownMini',
              isDisabled: isTransferActionDisabled,
            },
          ]}
        >
          <IconButton name="DotsHorizontalMini" size="lg" />
        </BaseMenu>
      </HStack>
    );
  }

  return (
    <HStack space={4} {...style}>
      {actions.map((action) => (
        <TouchableWithoutFeedback key={action.id}>
          <IconButton
            circle
            size="base"
            name={action.icon as ICON_NAMES}
            type="basic"
            onPress={action.onPress}
            isDisabled={action.isDisabled}
          />
        </TouchableWithoutFeedback>
      ))}
    </HStack>
  );
}

export { TokenActions };
