import React, { ComponentProps, FC, useCallback } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Divider,
  Icon,
  Pressable,
  Token as TokenIcon,
  Typography,
  VStack,
  useToast,
  utils,
} from '@onekeyhq/components';
import Logo from '@onekeyhq/components/src/Icon/react/illus/Logo';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useAccount,
  useActiveWalletAccount,
  useAddressName,
  useNetwork,
} from '../../../../hooks';
import useFormatDate from '../../../../hooks/useFormatDate';
import { buildTransactionDetailsUrl } from '../../../../hooks/useOpenBlockBrowser';
import { changeActiveNetwork } from '../../../../store/reducers/general';
import { sleep } from '../../../../utils/promiseUtils';
import {
  SwapRoutes,
  SwapRoutesParams,
  TransactionDetails,
  TransactionStatus,
} from '../../typings';
import { formatAmount } from '../../utils';
import SwappingVia from '../SwappingVia';
import TransactionRate from '../TransactionRate';

type TransactionProps = {
  tx: TransactionDetails;
};

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.Transaction>;
type NavigationProps = NavigationProp<SwapRoutesParams, SwapRoutes.Transaction>;

const formatAddressName = (address: string, name?: string) => {
  if (!name) {
    return `${utils.shortenAddress(address)}`;
  }
  return `${name}(${address.slice(-4)})`;
};

const StatusIcon: FC<{ status: TransactionStatus }> = ({ status }) => {
  if (status === 'sucesss') {
    return (
      <Center w="4" h="4" borderRadius="full" bg="action-primary-default">
        <Icon name="CheckSolid" size={12} color="icon-on-primary" />
      </Center>
    );
  }
  if (status === 'pending') {
    return (
      <Center
        w="4"
        h="4"
        borderRadius="full"
        style={{ 'backgroundColor': '#008CB8' }}
      >
        <Icon name="ClockSolid" size={12} color="icon-on-primary" />
      </Center>
    );
  }
  return (
    <Center w="4" h="4" borderRadius="full" bg="action-critical-default">
      <Icon name="CloseSolid" size={12} color="icon-on-primary" />
    </Center>
  );
};

const StatusTitle: FC<{ status: TransactionStatus }> = ({ status }) => {
  const intl = useIntl();
  if (status === 'sucesss') {
    return (
      <Typography.Body1Strong>
        {intl.formatMessage({ id: 'form__swap_success' })}
      </Typography.Body1Strong>
    );
  }
  if (status === 'pending') {
    return (
      <Typography.Body1Strong>
        {intl.formatMessage({ id: 'form__swap_pending' })}
      </Typography.Body1Strong>
    );
  }
  return (
    <Typography.Body1Strong>
      {intl.formatMessage({ id: 'form__swap_failed' })}
    </Typography.Body1Strong>
  );
};

const Header: FC<TransactionProps & { onPress?: () => Promise<void> }> = ({
  tx,
  onPress,
}) => {
  const intl = useIntl();
  const formatTime = useCallback(
    (ms: number) => {
      const seconds = Math.max(Math.ceil(ms / 1000), 1);
      if (seconds >= 60) {
        return intl.formatMessage(
          { id: 'content__str_mins' },
          { content__str_mins: Math.ceil(seconds / 60) },
        );
      }
      return intl.formatMessage(
        { id: 'content__str_seconds' },
        { content__str_seconds: seconds },
      );
    },
    [intl],
  );
  return (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
      <Box flexDirection="row">
        <Center
          w="10"
          h="10"
          bg="surface-neutral-default"
          borderRadius="full"
          position="relative"
          mr="3"
        >
          <Icon name="SwitchHorizontalSolid" size={20} />
          <Box position="absolute" bottom="0" right="0">
            <StatusIcon status={tx.status} />
          </Box>
        </Center>
        <Box>
          <StatusTitle status={tx.status} />
          {tx.confirmedTime ? (
            <Typography.Caption>
              {intl.formatMessage(
                { id: 'form__str_used' },
                { '0': formatTime(tx.confirmedTime - tx.addedTime) },
              )}
            </Typography.Caption>
          ) : (
            <Typography.Caption>
              {intl.formatMessage(
                { id: 'form__estimate_str' },
                {
                  '0': formatTime((tx.arrivalTime ?? 1) * 1000),
                },
              )}
            </Typography.Caption>
          )}
        </Box>
      </Box>
      {tx.status === 'sucesss' ? (
        <Button size="xs" onPromise={onPress}>
          {intl.formatMessage({ id: 'action__swap_again' })}
        </Button>
      ) : null}
    </Box>
  );
};

const InputOutput: FC<TransactionProps> = ({ tx }) => {
  const fromNetwork = useNetwork(tx.tokens?.from.networkId);
  const toNetwork = useNetwork(tx.tokens?.to.networkId);
  return (
    <Box my="6" borderRadius="12" background="surface-default" p="4">
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box flexDirection="row" alignItems="center">
          <TokenIcon size="8" src={tx.tokens?.from.token.logoURI} />
          <Box ml="3">
            <Typography.Body1>
              {formatAmount(tx.tokens?.from.amount, 4)}
              {tx.tokens?.from.token?.symbol.toString()}
            </Typography.Body1>
            <Typography.Body2 color="text-subdued">
              {fromNetwork?.shortName}
            </Typography.Body2>
          </Box>
        </Box>
      </Box>
      <Box
        h="8"
        w="full"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box mr="4" width="8" flexDirection="row" justifyContent="center">
          <Icon name="ArrowDownSolid" size={16} />
        </Box>
        <Divider flex="1" />
      </Box>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box flexDirection="row" alignItems="center">
          <TokenIcon size="8" src={tx.tokens?.to.token.logoURI} />
          <Box ml="3">
            <Typography.Body1>
              {formatAmount(tx.tokens?.to.amount, 4)}
              {tx.tokens?.to.token.symbol.toUpperCase()}
            </Typography.Body1>
            <Typography.Body2 color="text-subdued">
              {toNetwork?.shortName}
            </Typography.Body2>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

type TransactionFieldProps = { label: string } & ComponentProps<typeof Box>;
const TransactionField: FC<TransactionFieldProps> = ({
  label,
  children,
  ...rest
}) => (
  <Box
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    {...rest}
  >
    <Typography.Caption color="text-disabled">{label}</Typography.Caption>
    <Box>{children}</Box>
  </Box>
);

const Transaction: FC<TransactionProps & { showViewInBrowser?: boolean }> = ({
  tx,
  showViewInBrowser,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  const { networkId } = useActiveWalletAccount();
  const account = useAccount(tx.accountId);
  const network = useNetwork(tx.networkId);
  const fromNetwork = useNetwork(tx.tokens?.from.networkId);
  const toNetwork = useNetwork(tx.tokens?.to.networkId);
  const receivingName = useAddressName({ address: tx.receivingAddress });
  const { formatDate } = useFormatDate();
  const { from, to } = tx.tokens ?? {};
  const swftcOrderId = tx.attachment?.swftcOrderId ?? tx.thirdPartyOrderId;

  const onCopy = useCallback(
    (text?: string) => {
      if (!text) {
        return;
      }
      copyToClipboard(text);
      toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    },
    [toast, intl],
  );

  const onOpenUrl = useCallback(
    (url: string) => {
      if (platformEnv.isNative) {
        navigation.navigate(SwapRoutes.Webview, { url });
      } else {
        global.open(url, '_blank');
      }
    },
    [navigation],
  );

  const onOpenTx = useCallback(() => {
    const url = buildTransactionDetailsUrl(network, tx.hash);
    onOpenUrl(url);
  }, [onOpenUrl, network, tx.hash]);

  const onPress = useCallback(async () => {
    if (from && to && fromNetwork && toNetwork) {
      if (networkId !== fromNetwork.id) {
        backgroundApiProxy.dispatch(changeActiveNetwork(fromNetwork.id));
        await sleep(500);
      }
      backgroundApiProxy.serviceSwap.selectToken(
        'INPUT',
        fromNetwork,
        from.token,
      );
      backgroundApiProxy.serviceSwap.selectToken('OUTPUT', toNetwork, to.token);

      const parent = navigation.getParent() ?? navigation;
      parent.goBack();

      setTimeout(() => {
        route.params.goBack?.();
      }, 100);
    }
  }, [from, to, fromNetwork, toNetwork, navigation, networkId, route.params]);

  if (!account || !network) {
    return null;
  }

  return (
    <Box>
      <Header tx={tx} onPress={onPress} />
      <InputOutput tx={tx} />
      <VStack space={4}>
        {tx.receivingAddress !== undefined &&
        tx.receivingAddress !== account.address ? (
          <>
            <TransactionField
              label={intl.formatMessage({ id: 'content__from' })}
            >
              <Pressable
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                onPress={() => onCopy(account.address)}
              >
                <Typography.Caption mr="1">
                  {formatAddressName(account.address, account.name)}
                </Typography.Caption>
                <Icon name="DuplicateOutline" size={12} color="text-subdued" />
              </Pressable>
            </TransactionField>
            <TransactionField label={intl.formatMessage({ id: 'content__to' })}>
              <Pressable
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                onPress={() => onCopy(tx.receivingAddress)}
              >
                <Typography.Caption mr="1" color="text-subdued">
                  {formatAddressName(tx.receivingAddress, receivingName)}
                </Typography.Caption>
                <Icon name="DuplicateOutline" size={12} color="text-subdued" />
              </Pressable>
            </TransactionField>
          </>
        ) : (
          <TransactionField label={intl.formatMessage({ id: 'form__account' })}>
            <Pressable
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              onPress={() => onCopy(account.address)}
            >
              <Typography.Caption mr="1" color="text-subdued">
                {formatAddressName(account.address, account.name)}
              </Typography.Caption>
              <Icon name="DuplicateOutline" size={12} color="text-subdued" />
            </Pressable>
          </TransactionField>
        )}
        <TransactionField label={intl.formatMessage({ id: 'Rate' })}>
          <TransactionRate
            tokenA={tx.tokens?.from.token}
            tokenB={tx.tokens?.to.token}
            rate={tx.tokens?.rate}
            typography="Caption"
            color="text-subdued"
          />
        </TransactionField>
        <TransactionField
          label={intl.formatMessage({ id: 'form__swapping_via' })}
        >
          <SwappingVia providers={tx.providers} />
        </TransactionField>
        <TransactionField label={intl.formatMessage({ id: 'form__created' })}>
          <Typography.Caption color="text-subdued">
            {formatDate(new Date(tx.addedTime))}
          </Typography.Caption>
        </TransactionField>
        <TransactionField label={intl.formatMessage({ id: 'form__updated' })}>
          <Typography.Caption color="text-subdued">
            {formatDate(new Date(tx.confirmedTime ?? tx.addedTime))}
          </Typography.Caption>
        </TransactionField>
        <TransactionField label={intl.formatMessage({ id: 'content__hash' })}>
          <Pressable flexDirection="row" alignItems="center" onPress={onOpenTx}>
            <Typography.Caption color="text-subdued" mr="1">
              {utils.shortenAddress(tx.hash)}
            </Typography.Caption>
            <Icon name="ExternalLinkSolid" color="text-subdued" size={12} />
          </Pressable>
        </TransactionField>
        {swftcOrderId ? (
          <TransactionField
            label={intl.formatMessage({ id: 'form__order_no' })}
          >
            <Pressable
              flexDirection="row"
              alignItems="center"
              onPress={() => onCopy(swftcOrderId ?? '')}
            >
              <Typography.Caption color="text-subdued">
                {utils.shortenAddress(swftcOrderId)}
              </Typography.Caption>
              <Icon name="DuplicateOutline" size={12} />
            </Pressable>
          </TransactionField>
        ) : null}
      </VStack>
      <Divider my="4" />
      {showViewInBrowser ? (
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Logo width={82} height={25} />
          <Pressable flexDirection="row" onPress={onOpenTx}>
            <Typography.Caption mr="1" color="text-subdued">
              {intl.formatMessage({ id: 'action__view_in_browser' })}
            </Typography.Caption>
            <Icon name="ExternalLinkOutline" size={12} color="text-subdued" />
          </Pressable>
        </Box>
      ) : null}
    </Box>
  );
};

export default Transaction;
