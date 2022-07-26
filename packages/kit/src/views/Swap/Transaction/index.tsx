import React, { FC, useCallback } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Button,
  Divider,
  Icon,
  IconButton,
  Modal,
  Token,
  Typography,
  useToast,
  utils,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAccount, useAddressName, useNetwork } from '../../../hooks';
import useFormatDate from '../../../hooks/useFormatDate';
import { buildTransactionDetailsUrl } from '../../../hooks/useOpenBlockBrowser';
import TokenPair from '../components/TokenPair';
import TransactionRate from '../components/TransactionRate';
import TransactionStatus from '../components/TransactionStatus';
import { swftcCustomerSupportUrl } from '../config';
import { useTransactions } from '../hooks/useTransactions';
import { SwapRoutes, SwapRoutesParams, TransactionDetails } from '../typings';
import { formatAmount } from '../utils';

type TransactionProps = {
  tx: TransactionDetails;
};

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.Transaction>;
type NavigationProps = NavigationProp<SwapRoutesParams, SwapRoutes.Transaction>;

const formatTransactionAccount = (address: string, name?: string) => {
  if (!name) {
    return `${utils.shortenAddress(address)}`;
  }
  return `${name}(${address.slice(-4)})`;
};

const Transaction: FC<TransactionProps> = ({ tx }) => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const { formatDate } = useFormatDate();
  const account = useAccount(tx.accountId);
  const network = useNetwork(tx.networkId);
  const fromNetwork = useNetwork(tx.tokens?.from.networkId);
  const toNetwork = useNetwork(tx.tokens?.to.networkId);
  const receivingName = useAddressName({ address: tx.receivingAddress });

  const swftcOrderId = tx.attachment?.swftcOrderId ?? tx.thirdPartyOrderId;

  const onCopy = useCallback(
    (text: string) => {
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

  const onOpenCustomerSupport = useCallback(() => {
    if (platformEnv.isNative) {
      navigation.navigate(SwapRoutes.SwftcHelp, {
        orderid: tx.thirdPartyOrderId ?? '',
      });
    } else {
      global.open(swftcCustomerSupportUrl, '_blank');
    }
  }, [navigation, tx.thirdPartyOrderId]);

  const onOpenTx = useCallback(() => {
    const url = buildTransactionDetailsUrl(network, tx.hash);
    onOpenUrl(url);
  }, [onOpenUrl, network, tx.hash]);

  if (!account || !network) {
    return null;
  }

  return (
    <Box>
      <Box flexDirection="row" mb="4" alignItems="center">
        <Box w="9" h="9" mr="2">
          <TokenPair from={tx.tokens?.from.token} to={tx.tokens?.to.token} />
        </Box>
        <Box>
          <Typography.Heading>
            {tx.tokens
              ? `${tx.tokens.from.token.symbol} → ${tx.tokens.to.token.symbol}`
              : intl.formatMessage({ id: 'title__swap' })}
          </Typography.Heading>
          <Box flexDirection="row" alignItems="center">
            <TransactionStatus tx={tx} />
            <Typography.Body2 color="text-subdued">
              {formatDate(new Date(tx.addedTime))}
            </Typography.Body2>
          </Box>
        </Box>
      </Box>
      <Box mb="4" borderRadius="12" background="surface-default" p="4">
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box flexDirection="row" alignItems="center">
            <Token size="8" src={tx.tokens?.from.token.logoURI} />
            <Box ml="3">
              <Typography.Body1>
                {tx.tokens?.from.token?.symbol.toString()}
              </Typography.Body1>
              <Typography.Body2 color="text-subdued">
                {fromNetwork?.shortName}
              </Typography.Body2>
            </Box>
          </Box>
          <Box flex="1" flexDirection="row" justifyContent="flex-end">
            <Typography.DisplayMedium maxW="full" textAlign="right">
              {formatAmount(tx.tokens?.from.amount, 4)}
            </Typography.DisplayMedium>
          </Box>
        </Box>
        <Box
          h="5"
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
            <Token size="8" src={tx.tokens?.to.token.logoURI} />
            <Box ml="3">
              <Typography.Body1>
                {tx.tokens?.to.token.symbol.toUpperCase()}
              </Typography.Body1>
              <Typography.Body2 color="text-subdued">
                {toNetwork?.shortName}
              </Typography.Body2>
            </Box>
          </Box>
          <Box flex="1" flexDirection="row" justifyContent="flex-end">
            <Typography.DisplayMedium
              color="text-success"
              maxW="full"
              textAlign="right"
            >
              +{formatAmount(tx.tokens?.to.amount, 4)}
            </Typography.DisplayMedium>
          </Box>
        </Box>
      </Box>
      <Box borderRadius={12} bg="surface-default" p="4">
        <Box mb="4">
          <Typography.Body1Strong color="text-subdued">
            {tx.receivingAddress && tx.receivingAddress !== account.address
              ? intl.formatMessage({ id: 'content__from' })
              : intl.formatMessage({ id: 'form__account' })}
          </Typography.Body1Strong>
          <Box flexDirection="row" alignItems="center">
            <Typography.Body1Strong>
              {formatTransactionAccount(account.address, account.name)}
            </Typography.Body1Strong>
            <IconButton
              name="DuplicateOutline"
              type="plain"
              onPress={() => onCopy(account.address)}
            />
          </Box>
        </Box>
        {tx.receivingAddress && tx.receivingAddress !== account.address ? (
          <Box mb="4">
            <Typography.Body1Strong color="text-subdued">
              {intl.formatMessage({ id: 'content__to' })}
            </Typography.Body1Strong>
            <Box flexDirection="row" alignItems="center">
              <Typography.Body1Strong>
                {formatTransactionAccount(tx.receivingAddress, receivingName)}
              </Typography.Body1Strong>
              <IconButton
                name="DuplicateOutline"
                type="plain"
                onPress={() => onCopy(tx.receivingAddress ?? '')}
              />
            </Box>
          </Box>
        ) : null}
        <Box mb="4">
          <Typography.Body1Strong color="text-subdued">
            {intl.formatMessage({ id: 'Rate' })}
          </Typography.Body1Strong>
          <Box flexDirection="row">
            <TransactionRate
              tokenA={tx.tokens?.from.token}
              tokenB={tx.tokens?.to.token}
              rate={tx.tokens?.rate}
              typography="Body1Strong"
            />
          </Box>
        </Box>
        <Box mb="4">
          <Typography.Body1Strong color="text-subdued">
            {intl.formatMessage({ id: 'title__channel' })}
          </Typography.Body1Strong>
          <Box flexDirection="row">
            <Typography.Body1Strong>{tx.quoterType}</Typography.Body1Strong>
          </Box>
        </Box>
        {!swftcOrderId ? (
          <Box>
            <Typography.Body1Strong color="text-subdued">
              {intl.formatMessage({ id: 'content__hash' })}
            </Typography.Body1Strong>
            <Box flexDirection="row" alignItems="center">
              <Typography.Body1Strong>
                {utils.shortenAddress(tx.hash)}
              </Typography.Body1Strong>
              <IconButton
                type="plain"
                name="ExternalLinkSolid"
                onPress={onOpenTx}
              />
            </Box>
          </Box>
        ) : null}
        {swftcOrderId ? (
          <Box>
            <Typography.Body1Strong color="text-subdued">
              {intl.formatMessage({ id: 'title__order_id' })}
            </Typography.Body1Strong>
            <Box flexDirection="row" alignItems="center">
              <Typography.Body1Strong>
                {utils.shortenAddress(swftcOrderId)}
              </Typography.Body1Strong>
              <IconButton
                type="plain"
                name="DuplicateOutline"
                onPress={() => onCopy(swftcOrderId ?? '')}
              />
            </Box>
          </Box>
        ) : null}
      </Box>
      {swftcOrderId ? (
        <Box mt="6">
          <Alert
            alertType="info"
            dismiss={false}
            title={intl.formatMessage({
              id: 'msg__this_is_a_cross_chain_swap_transaction',
            })}
            description={intl.formatMessage({
              id: 'msg__this_is_a_cross_chain_swap_transaction_desc',
            })}
          />
          <Button
            size="lg"
            leftIconName="ChatSolid"
            mt="6"
            type="plain"
            onPress={onOpenCustomerSupport}
          >
            {intl.formatMessage({ id: 'action__contact_third_party_provider' })}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

const TransactionModal = () => {
  const route = useRoute<RouteProps>();
  const { accountId, networkId, txid } = route.params;
  const transactions = useTransactions(accountId, networkId);
  const tx = transactions.filter((s) => s.hash === txid)[0];
  return (
    <Modal
      footer={null}
      scrollViewProps={{
        children: <Transaction tx={tx} />,
      }}
    />
  );
};

export default TransactionModal;
