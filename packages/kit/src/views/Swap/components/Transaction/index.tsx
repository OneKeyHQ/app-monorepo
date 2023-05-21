import { useCallback, useEffect, useMemo } from 'react';
import type { ComponentProps, FC } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Divider,
  Icon,
  Image,
  Pressable,
  Select,
  ToastManager,
  Token as TokenIcon,
  Typography,
  VStack,
} from '@onekeyhq/components';
import Logo from '@onekeyhq/components/src/Icon/react/illus/Logo';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAddressName, useNetworkSimple } from '../../../../hooks';
import useFormatDate from '../../../../hooks/useFormatDate';
import { buildTransactionDetailsUrl } from '../../../../hooks/useOpenBlockBrowser';
import { openUrlExternal } from '../../../../utils/openUrl';
import { useTransactionsAccount } from '../../hooks/useTransactions';
import {
  calculateProtocalsFee,
  formatAmount,
  gt,
  multiply,
  normalizeProviderName,
} from '../../utils';
import { Scheduler } from '../PendingTransaction';
import SwappingVia from '../SwappingVia';
import TransactionFee from '../TransactionFee';
import TransactionRate from '../TransactionRate';

import { HashMoreMenu } from './HashMoreMenus';
import { AccountMoreMenus, ReceiptMoreMenus } from './MoreMenus';

import type {
  SwapRoutes,
  SwapRoutesParams,
  TransactionDetails,
  TransactionStatus,
} from '../../typings';
import type { NavigationProp, RouteProp } from '@react-navigation/native';

type TransactionProps = {
  tx: TransactionDetails;
};

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.Transaction>;
type NavigationProps = NavigationProp<SwapRoutesParams, SwapRoutes.Transaction>;

const StatusIcon: FC<{ status: TransactionStatus }> = ({ status }) => {
  if (status === 'sucesss') {
    return (
      <Center w="4" h="4" borderRadius="full" bg="action-primary-default">
        <Icon name="CheckMini" size={12} color="icon-on-primary" />
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
        <Icon name="ClockMini" size={12} color="icon-on-primary" />
      </Center>
    );
  }
  return (
    <Center w="4" h="4" borderRadius="full" bg="action-critical-default">
      <Icon name="XMarkMini" size={12} color="icon-on-primary" />
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

const Header: FC<TransactionProps & { onPress?: () => void }> = ({
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
          <Icon name="ArrowsRightLeftMini" size={25} color="text-on-primary" />
          <Box position="absolute" bottom="0" right="0">
            <StatusIcon status={tx.status} />
          </Box>
        </Center>
        <Box>
          <StatusTitle status={tx.status} />
          {tx.confirmedTime ? (
            <Typography.Caption color="text-subdued">
              {intl.formatMessage(
                { id: 'form__str_used' },
                { '0': formatTime(tx.confirmedTime - tx.addedTime) },
              )}
            </Typography.Caption>
          ) : (
            <Typography.Caption color="text-subdued">
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
        <Button size="xs" onPress={onPress}>
          {intl.formatMessage({ id: 'action__swap_again' })}
        </Button>
      ) : null}
    </Box>
  );
};

const InputOutput: FC<TransactionProps> = ({ tx }) => {
  const fromNetwork = useNetworkSimple(tx.tokens?.from.networkId);
  const toNetwork = useNetworkSimple(tx.tokens?.to.networkId);
  const receivingAccount = useTransactionsAccount(
    tx.receivingAccountId,
    tx.tokens?.to.networkId,
  );
  const account = useTransactionsAccount(
    tx.accountId,
    tx.tokens?.from.networkId,
  );
  const receivingName = useAddressName({ address: tx.receivingAddress });

  return (
    <Box my="0" px="0">
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box flexDirection="row" alignItems="center">
          <TokenIcon size="8" token={tx.tokens?.from.token} />
          <Box ml="3">
            <Typography.Body1>
              {formatAmount(tx.tokens?.from.amount, 4)}
              {tx.tokens?.from.token?.symbol.toString()}
            </Typography.Body1>
            <Typography.Body2 color="text-subdued">
              {fromNetwork?.name}
            </Typography.Body2>
          </Box>
        </Box>
        <AccountMoreMenus networkId={tx.networkId} accountId={tx.accountId}>
          <Pressable>
            <Box
              bg="action-secondary-default"
              borderWidth="1px"
              py="1"
              pl="1"
              pr="2"
              borderRadius="full"
              borderColor="border-default"
              flexDirection="row"
              alignItems="center"
            >
              <Image w="4" h="4" mr="1" src={fromNetwork?.logoURI} />
              <Typography.Body2Strong selectable={false}>
                {account?.name}
              </Typography.Body2Strong>
            </Box>
          </Pressable>
        </AccountMoreMenus>
      </Box>
      <Box
        h="8"
        w="full"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box mr="4" width="8" flexDirection="row" justifyContent="center">
          <Icon name="ArrowDownMini" size={16} />
        </Box>
      </Box>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box flexDirection="row" alignItems="center">
          <TokenIcon size="8" token={tx.tokens?.to.token} />
          <Box ml="3">
            <Box flexDirection="row" alignItems="center">
              {!tx.actualReceived ? (
                <Typography.Caption mr="1">~</Typography.Caption>
              ) : null}
              <Typography.Body1>
                {formatAmount(tx.tokens?.to.amount, 4)}
                {tx.tokens?.to.token.symbol.toUpperCase()}
              </Typography.Body1>
            </Box>
            <Typography.Body2 color="text-subdued">
              {toNetwork?.name}
            </Typography.Body2>
          </Box>
        </Box>
        <ReceiptMoreMenus
          address={tx.receivingAddress}
          networkId={tx.tokens?.to.networkId}
          accountId={tx.receivingAccountId}
        >
          <Pressable>
            <Box
              bg="action-secondary-default"
              borderWidth="1px"
              py="1"
              pl="1"
              pr="2"
              borderRadius="full"
              borderColor="border-default"
              flexDirection="row"
              alignItems="center"
            >
              <Image w="4" h="4" mr="1" src={toNetwork?.logoURI} />
              <Typography.Body2Strong selectable={false}>
                {receivingAccount?.name ||
                  receivingName ||
                  shortenAddress(tx.receivingAddress || '')}
              </Typography.Body2Strong>
            </Box>
          </Pressable>
        </ReceiptMoreMenus>
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
    position="relative"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    {...rest}
  >
    <Typography.Body2 color="text-disabled">{label}</Typography.Body2>
    <Box>{children}</Box>
  </Box>
);

type ViewInBrowserSelectorItem = {
  label: string;
  value?: string;
  logoURI?: string;
  url?: string;
};

type Option = {
  label: string;
  logoURI: string;
  value: string;
  url: string;
};
type ViewInBrowserSelectorProps = { tx: TransactionDetails };
const ViewInBrowserSelector: FC<ViewInBrowserSelectorProps> = ({ tx }) => {
  const intl = useIntl();
  const fromNetwork = useNetworkSimple(tx.tokens?.from.networkId);
  const toNetwork = useNetworkSimple(tx.tokens?.to.networkId);

  const options = useMemo(() => {
    let base: Option[] = [
      {
        label: fromNetwork?.shortName ?? '',
        logoURI: fromNetwork?.logoURI ?? '',
        value: tx.hash ?? '',
        url: buildTransactionDetailsUrl(fromNetwork, tx.hash),
      },
      {
        label: toNetwork?.shortName ?? '',
        logoURI: toNetwork?.logoURI ?? '',
        value: tx.destinationTransactionHash ?? '',
        url: buildTransactionDetailsUrl(
          toNetwork,
          tx.destinationTransactionHash,
        ),
      },
    ];
    if (tx.quoterType === 'socket') {
      const socketOption: Option[] = [
        {
          label: 'Socketscan',
          logoURI: 'https://common.onekey-asset.com/logo/SocketBridge.png',
          value: 'Socketscan',
          url: `https://socketscan.io/tx/${tx.hash}`,
        },
      ];
      base = socketOption.concat(base);
    }
    return base;
  }, [tx, fromNetwork, toNetwork]);
  const onPress = useCallback((_: any, item: any) => {
    // eslint-disable-next-line
    if (item.url) {
      // eslint-disable-next-line
      openUrlExternal(item.url);
    }
  }, []);

  useEffect(() => {
    if (tx.status !== 'pending' && !tx.destinationTransactionHash) {
      const s = new Scheduler(tx);
      s.runTask();
    }
    // eslint-disable-next-line
  }, []);

  return (
    <Select
      footer={null}
      title={intl.formatMessage({
        id: 'title__select_blockchain_browser',
      })}
      isTriggerPlain
      options={options}
      headerShown={false}
      dropdownProps={{ width: '64' }}
      dropdownPosition="right"
      onChange={onPress}
      renderItem={(item, _, onChange) => {
        const token = item as unknown as ViewInBrowserSelectorItem;
        return (
          <Pressable
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            key={item.value}
            h="12"
            px="3"
            onPress={() => onChange?.('', item)}
          >
            <Box flexDirection="row" alignItems="center">
              <TokenIcon size="8" token={token} />
              <Typography.Body1Strong ml={3}>
                {token.label}
              </Typography.Body1Strong>
            </Box>
            {!token.value ? (
              <Typography.Body1 color="text-disabled">
                {intl.formatMessage({
                  id: 'transaction__swap_status_waiting',
                })}
              </Typography.Body1>
            ) : null}
          </Pressable>
        );
      }}
      renderTrigger={() => (
        <Box flexDirection="row" alignItems="center">
          <Typography.Body2Strong mr="1">
            {intl.formatMessage({ id: 'action__view_in_browser' })}
          </Typography.Body2Strong>
          <Icon name="ArrowTopRightOnSquareOutline" size={16} />
        </Box>
      )}
    />
  );
};

type ViewInBrowserLinkProps = { tx: TransactionDetails };
const ViewInBrowserLink: FC<ViewInBrowserLinkProps> = ({ tx }) => {
  const intl = useIntl();
  const network = useNetworkSimple(tx.networkId);
  const onOpenTx = useCallback(() => {
    const url = buildTransactionDetailsUrl(network, tx.hash);
    openUrlExternal(url);
  }, [network, tx.hash]);

  return (
    <Pressable flexDirection="row" onPress={onOpenTx} alignItems="center">
      <Typography.Body2Strong mr="1">
        {intl.formatMessage({ id: 'action__view_in_browser' })}
      </Typography.Body2Strong>
      <Icon name="ArrowTopRightOnSquareOutline" size={16} />
    </Pressable>
  );
};

type ViewInBrowserProps = { tx: TransactionDetails };
const ViewInBrowser: FC<ViewInBrowserProps> = ({ tx }) => {
  const { from, to } = tx.tokens ?? {};
  return from?.networkId !== to?.networkId ? (
    <ViewInBrowserSelector tx={tx} />
  ) : (
    <ViewInBrowserLink tx={tx} />
  );
};

type TransactionOneKeyFeesProps = { tx: TransactionDetails };
const TransactionOneKeyFees: FC<TransactionOneKeyFeesProps> = ({ tx }) => {
  const from = tx.tokens?.from;
  return (
    <Box flexDirection="row" alignItems="center">
      <TransactionFee
        type={tx.quoterType}
        percentageFee={tx.percentageFee}
        typography="Body2Strong"
        color="text-default"
      />
      {from && tx.percentageFee ? (
        <Typography.Body2Strong>{`(${formatAmount(
          multiply(tx.percentageFee, from.amount),
          8,
        )}${from.token.symbol.toUpperCase()})`}</Typography.Body2Strong>
      ) : null}
    </Box>
  );
};

type TransactionProtocalsFeesProps = { tx: TransactionDetails };
const TransactionProtocalsFees: FC<TransactionProtocalsFeesProps> = ({
  tx,
}) => {
  const intl = useIntl();
  if (tx.protocalFees) {
    const result = calculateProtocalsFee(tx.protocalFees);
    if (Number(result.value) > 0) {
      return (
        <TransactionField
          label={intl.formatMessage({ id: 'form__bridge_fee' })}
        >
          <Typography.Body2Strong>
            {`${formatAmount(result.value)} ${result.symbol.toUpperCase()}`}
          </Typography.Body2Strong>
        </TransactionField>
      );
    }
  }
  return null;
};

const Transaction: FC<TransactionProps & { showViewInBrowser?: boolean }> = ({
  tx,
  showViewInBrowser,
}) => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  const account = useTransactionsAccount(
    tx.accountId,
    tx.tokens?.from.networkId,
  );
  const network = useNetworkSimple(tx.networkId);
  const fromNetwork = useNetworkSimple(tx.tokens?.from.networkId);
  const toNetwork = useNetworkSimple(tx.tokens?.to.networkId);

  const { formatDate } = useFormatDate();
  const { from, to } = tx.tokens ?? {};
  const swftcOrderId = tx.attachment?.swftcOrderId ?? tx.thirdPartyOrderId;

  const onCopy = useCallback(
    (text?: string) => {
      if (!text) {
        return;
      }
      copyToClipboard(text);
      ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    },
    [intl],
  );

  const onPress = useCallback(() => {
    if (from && to && fromNetwork && toNetwork) {
      backgroundApiProxy.serviceSwap.setInputToken(from.token);
      backgroundApiProxy.serviceSwap.setOutputToken(to.token);

      const parent = navigation.getParent() ?? navigation;
      parent.goBack();

      setTimeout(() => {
        route.params.goBack?.();
      }, 100);
    }
  }, [from, to, fromNetwork, toNetwork, navigation, route.params]);

  if (!account || !network) {
    return null;
  }

  return (
    <Box>
      <Header tx={tx} onPress={onPress} />
      <Divider my="6" />
      <InputOutput tx={tx} />
      <Divider my="6" />
      <Box>
        <Typography.Subheading color="text-subdued" mb="4">
          {intl.formatMessage({ id: 'form__on_chain_info_uppercase' })}
        </Typography.Subheading>
        <VStack space={4}>
          {tx.actualReceived ? (
            <TransactionField
              label={intl.formatMessage({ id: 'form__actual_received' })}
            >
              <Typography.Body2Strong>
                {`${formatAmount(tx.actualReceived, 6)} ${
                  to?.token.symbol.toUpperCase() ?? ''
                }`}
              </Typography.Body2Strong>
            </TransactionField>
          ) : null}
          {tx.networkFee ? (
            <TransactionField
              label={intl.formatMessage({ id: 'form__network_fee' })}
            >
              <Typography.Body2Strong>
                {`${formatAmount(tx.networkFee, 8)} ${
                  network.symbol.toUpperCase() ?? ''
                }`}
              </Typography.Body2Strong>
            </TransactionField>
          ) : null}
          <TransactionField label={intl.formatMessage({ id: 'content__hash' })}>
            <HashMoreMenu tx={tx}>
              <Pressable mr="1" maxW="56">
                <Typography.Body2Strong textAlign="right">
                  {tx.hash}
                </Typography.Body2Strong>
              </Pressable>
            </HashMoreMenu>
          </TransactionField>
        </VStack>
      </Box>
      <Divider my="6" />
      <Box>
        <Typography.Subheading color="text-subdued" mb="4">
          {intl.formatMessage({ id: 'form__swap_info_uppercase' })}
        </Typography.Subheading>
        <VStack space={4}>
          <TransactionField label={intl.formatMessage({ id: 'Rate' })}>
            <TransactionRate
              tokenA={tx.tokens?.from.token}
              tokenB={tx.tokens?.to.token}
              rate={tx.tokens?.rate}
              typography="Body2Strong"
              color="text-default"
            />
          </TransactionField>

          {tx.quoterType ? (
            <TransactionField
              label={intl.formatMessage({ id: 'form__provided_by' })}
            >
              <Box flexDirection="row" alignItems="center">
                {tx.quoterLogo ? (
                  <Image
                    borderRadius="full"
                    overflow="hidden"
                    src={tx.quoterLogo}
                    w="4"
                    h="4"
                    mr="2"
                  />
                ) : null}
                <Typography.Body2Strong>
                  {normalizeProviderName(tx.quoterType)}
                </Typography.Body2Strong>
              </Box>
            </TransactionField>
          ) : null}
          <TransactionField
            label={intl.formatMessage({ id: 'form__swapping_via' })}
          >
            <SwappingVia
              providers={tx.providers}
              typography="Body2Strong"
              color="text-default"
            />
          </TransactionField>
          {gt(tx.protocalFees?.amount ?? '0', 0) ? (
            <TransactionProtocalsFees tx={tx} />
          ) : null}
          {tx.percentageFee ? (
            <TransactionField
              label={intl.formatMessage({ id: 'form__included_onekey_fee' })}
            >
              <TransactionOneKeyFees tx={tx} />
            </TransactionField>
          ) : null}
          {swftcOrderId ? (
            <TransactionField
              label={intl.formatMessage({ id: 'form__order_no' })}
            >
              <Pressable
                flexDirection="row"
                alignItems="center"
                onPress={() => onCopy(swftcOrderId ?? '')}
              >
                <Box maxW="56" mr="1">
                  <Typography.Body2Strong textAlign="right">
                    {swftcOrderId}
                  </Typography.Body2Strong>
                </Box>
                <Icon name="Square2StackOutline" size={16} />
              </Pressable>
            </TransactionField>
          ) : null}
        </VStack>
      </Box>
      <Divider my="6" />
      <Box>
        <Typography.Subheading color="text-subdued" mb="4">
          {intl.formatMessage({ id: 'form__time_uppercase' })}
        </Typography.Subheading>
        <VStack space={4}>
          <TransactionField label={intl.formatMessage({ id: 'form__created' })}>
            <Typography.Body2Strong color="text-default">
              {formatDate(new Date(tx.addedTime))}
            </Typography.Body2Strong>
          </TransactionField>
          <TransactionField label={intl.formatMessage({ id: 'form__updated' })}>
            <Typography.Body2Strong color="text-default">
              {formatDate(new Date(tx.confirmedTime ?? tx.addedTime))}
            </Typography.Body2Strong>
          </TransactionField>
        </VStack>
      </Box>
      <Divider my="7" />
      {showViewInBrowser ? (
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Logo width={82} height={25} />
          <ViewInBrowser tx={tx} />
        </Box>
      ) : null}
    </Box>
  );
};

export default Transaction;
