/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
  Icon,
  IconButton,
  Pressable,
  ToastManager,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { HomeRoutes } from '../../routes/routesEnum';
import { setMode } from '../../store/reducers/swap';
import { setTransactionViewed } from '../../store/reducers/swapTransactions';

import { limitOrderNetworkIds } from './config';
import { useWalletsSwapTransactions } from './hooks/useTransactions';

import type { HomeRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const HistoryPendingIndicator = () => {
  const [len, setLen] = useState(1);
  useEffect(() => {
    const timer = setInterval(
      () => setLen((prev) => (prev >= 3 ? 1 : prev + 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const items = useMemo(() => Array.from({ length: len }, (v, k) => k), [len]);

  return (
    <HStack w="4">
      {items.map((item) => (
        <Typography.CaptionStrong key={item}>.</Typography.CaptionStrong>
      ))}
    </HStack>
  );
};

type HistoryStatusButtonProps = {
  onPress?: () => void;
  text: string;
  iconName: ComponentProps<typeof Icon>['name'];
  backgroundColor?: ComponentProps<typeof Pressable>['backgroundColor'];
  borderColor?: ComponentProps<typeof Pressable>['borderColor'];
  rightSlot?: React.ReactNode;
};

const HistoryStatusButton: FC<HistoryStatusButtonProps> = ({
  onPress,
  text,
  iconName,
  backgroundColor,
  borderColor,
  rightSlot,
}) => (
  <Pressable onPress={onPress}>
    <Box
      py="2"
      px="3"
      flexDirection="row"
      alignItems="center"
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      borderRadius={12}
    >
      <Box mr="2">
        <Icon name={iconName} size={16} />
      </Box>
      <Typography.CaptionStrong>{text}</Typography.CaptionStrong>
      {rightSlot ? <Box ml="2">{rightSlot}</Box> : null}
    </Box>
  </Pressable>
);

const HistoryPendingButton: FC<{ onPress?: () => void }> = ({ onPress }) => {
  const intl = useIntl();
  const transactions = useWalletsSwapTransactions();
  const pendings = transactions.filter(
    (tx) => tx.status === 'pending' && tx.type === 'swap',
  );
  return (
    <HistoryStatusButton
      onPress={onPress}
      iconName="ClockOutline"
      backgroundColor="surface-highlight-default"
      text={intl.formatMessage(
        { id: 'msg__str_in_progress' },
        { '0': pendings.length },
      )}
      rightSlot={<HistoryPendingIndicator />}
    />
  );
};

const HistoryDoneButton: FC<{ onPress?: () => void }> = ({ onPress }) => {
  const intl = useIntl();
  const transactions = useWalletsSwapTransactions();
  const completed = transactions.filter(
    (tx) => tx.status === 'sucesss' && tx.viewed === false,
  );
  const failed = transactions.filter(
    (tx) =>
      (tx.status === 'failed' || tx.status === 'canceled') &&
      tx.viewed === false,
  );

  const onSetTransactionViewed = useCallback(() => {
    const txs = transactions.filter(
      (tx) => tx.status !== 'pending' && tx.viewed === false,
    );
    backgroundApiProxy.dispatch(
      setTransactionViewed({ txids: txs.map((o) => o.hash) }),
    );
    onPress?.();
  }, [transactions, onPress]);

  if (failed.length) {
    return (
      <HistoryStatusButton
        iconName="XCircleOutline"
        onPress={onSetTransactionViewed}
        text={intl.formatMessage(
          { id: 'msg__str_swap_failed' },
          { '0': failed.length },
        )}
        backgroundColor="surface-critical-default"
        borderColor="surface-critical-subdued"
      />
    );
  }

  if (completed.length) {
    return (
      <HistoryStatusButton
        iconName="CheckCircleOutline"
        onPress={onSetTransactionViewed}
        text={intl.formatMessage(
          { id: 'msg__str_swap_done' },
          { '0': completed.length },
        )}
        backgroundColor="surface-success-default"
        borderColor="surface-success-subdued"
      />
    );
  }

  return <IconButton type="plain" name="ClockOutline" onPress={onPress} />;
};

const HistoryButton = () => {
  const transactions = useWalletsSwapTransactions();
  const pendings = transactions.filter(
    (tx) => tx.status === 'pending' && tx.type === 'swap',
  );
  const navigation = useNavigation<NavigationProps>();
  const onPress = useCallback(() => {
    navigation.navigate(HomeRoutes.SwapHistory);
  }, [navigation]);
  if (pendings.length > 0) {
    return <HistoryPendingButton onPress={onPress} />;
  }
  return <HistoryDoneButton onPress={onPress} />;
};

export const SwapHeaderButtons = () => <HistoryButton />;

export const SwapHeaderSwitch = () => {
  const intl = useIntl();
  const swapMode = useAppSelector((s) => s.swap.mode);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const isSwap = swapMode === 'swap';

  const setLimitOrderMode = useCallback(() => {
    if (!inputToken || !limitOrderNetworkIds.includes(inputToken.networkId)) {
      ToastManager.show(
        {
          title: intl.formatMessage(
            {
              id: 'limit_orders_are_only_supported_for_str',
            },
            { '0': 'ETH, BSC, Polygon' },
          ),
        },
        { type: 'default' },
      );
    }
    backgroundApiProxy.serviceLimitOrder.setDefaultTokens();
    backgroundApiProxy.dispatch(setMode('limit'));
  }, [inputToken, intl]);

  return (
    <Box flexDirection="row" alignItems="center" h="30px">
      <Pressable
        mr="3"
        onPress={() => backgroundApiProxy.dispatch(setMode('swap'))}
      >
        <Typography.Body1Strong
          color={isSwap ? 'text-default' : 'text-disabled'}
        >
          {intl.formatMessage({ id: 'title__swap' })}
        </Typography.Body1Strong>
      </Pressable>
      <Pressable
        onPress={setLimitOrderMode}
        flexDirection="row"
        alignItems="center"
      >
        <Typography.Body1Strong
          color={!isSwap ? 'text-default' : 'text-disabled'}
        >
          {intl.formatMessage({ id: 'form__limit' })}
        </Typography.Body1Strong>
        <Box ml="1">
          <Badge type="info" size="sm" title="Beta" />
        </Box>
      </Pressable>
    </Box>
  );
};

export const SwapHeader = () => (
  <Box
    width="full"
    flexDirection="row"
    h="9"
    justifyContent="space-between"
    alignItems="center"
  >
    <SwapHeaderSwitch />
    <SwapHeaderButtons />
  </Box>
);
