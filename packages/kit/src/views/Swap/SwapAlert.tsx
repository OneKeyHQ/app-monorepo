import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  BottomSheetModal,
  Box,
  Button,
  Center,
  Icon,
  Typography,
} from '@onekeyhq/components';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useCreateAccountInWallet } from '../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNetworkSimple,
} from '../../hooks';
import { showOverlay } from '../../utils/overlayUtils';

import { useInputLimitsError } from './hooks/useSwap';
import { usePriceImpact } from './hooks/useSwapUtils';
import { SwapError } from './typings';

const RecipientBox = () => {
  const intl = useIntl();
  const { wallet } = useActiveWalletAccount();
  const accounts = useAppSelector((s) => s.runtime.accounts);
  const outputToken = useAppSelector((s) => s.swap.outputToken);

  const network = useNetworkSimple(outputToken?.networkId);
  const { createAccount } = useCreateAccountInWallet({
    networkId: network?.id,
    walletId: wallet?.id,
  });

  const show = useMemo(() => {
    if (!outputToken) {
      return false;
    }
    if (wallet?.accounts.length === 0) {
      return true;
    }
    const result = wallet?.accounts.every(
      (acc) => !isAccountCompatibleWithNetwork(acc, outputToken.networkId),
    );
    return result;
  }, [wallet, outputToken]);

  useEffect(() => {
    if (network) {
      backgroundApiProxy.serviceSwap.setRecipient(network);
    }
  }, [accounts, network]);

  return show ? (
    <Box mt="6">
      <Alert
        title={intl.formatMessage(
          {
            id: 'content__you_don_t_have_a_str_account',
          },
          { '0': network?.symbol ?? '' },
        )}
        alertType="info"
        actionType="right"
        action={intl.formatMessage({ id: 'action__create' })}
        onAction={createAccount}
        dismiss={false}
      />
    </Box>
  ) : null;
};

const RecipientAlert = () => {
  const recipient = useAppSelector((s) => s.swap.recipient);

  if (recipient) {
    return null;
  }

  return <RecipientBox />;
};

const DepositLimitAlert = () => {
  const limitsError = useInputLimitsError();
  const intl = useIntl();
  const onAction = useCallback(() => {
    if (limitsError?.value) {
      backgroundApiProxy.serviceSwap.userInput('INPUT', limitsError.value);
    }
  }, [limitsError]);
  if (limitsError) {
    return (
      <Box mt="6">
        <Alert
          title={limitsError.message}
          alertType="warn"
          dismiss={false}
          actionType="right"
          onAction={onAction}
          action={intl.formatMessage({ id: 'action__fill_in' })}
        />
      </Box>
    );
  }
  return null;
};

const ErrorAlert = () => {
  const intl = useIntl();
  const error = useAppSelector((s) => s.swap.error);
  if (error === SwapError.NotSupport) {
    return (
      <Box mt="6">
        <Alert
          title={intl.formatMessage({
            id: 'msg__this_transaction_is_not_supported',
          })}
          alertType="warn"
          dismiss={false}
        />
      </Box>
    );
  }
  return null;
};

const ExchangeAddressAlertContent = () => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" mt="6">
      <Box mr="3">
        <Icon
          width={20}
          height={20}
          color="text-warning"
          name="ExclamationCircleOutline"
        />
      </Box>
      <Box flex="1">
        <Typography.Body2 color="text-warning">
          {intl.formatMessage({
            id: 'content__do_not_swap_directly_to_the_exchange',
          })}
        </Typography.Body2>
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage({
            id: 'content__do_not_swap_directly_to_the_exchange_desc',
          })}
        </Typography.Body2>
      </Box>
    </Box>
  );
};

const ExchangeAddressAlert = () => {
  const [recipientUnknown, setRecipientUnknown] = useState<boolean>(false);
  const recipient = useAppSelector((s) => s.swap.recipient);
  useEffect(() => {
    backgroundApiProxy.serviceSwap
      .recipientIsUnknown(recipient)
      .then(setRecipientUnknown);
  }, [recipient]);
  return recipientUnknown ? <ExchangeAddressAlertContent /> : null;
};

const PriceImpactAlertContent = () => {
  const intl = useIntl();
  useEffect(() => {
    async function main() {
      const priceImpactShown =
        await backgroundApiProxy.serviceSwap.getSwapPriceImpactShown();
      if (!priceImpactShown) {
        backgroundApiProxy.serviceSwap.setSwapPriceImpactShown(true);
        showOverlay((close) => (
          <BottomSheetModal
            title={intl.formatMessage({ id: 'modal__attention' })}
            closeOverlay={close}
          >
            <Center w="full">
              <Typography.Body1 textAlign="center" color="text-subdued">
                {intl.formatMessage({
                  id: 'msg__you_will_swap_tokens_for_10%_less_than_coingecko_s_rate_which_may_result_in_a_loss',
                })}
              </Typography.Body1>
              <Center w="full" mt="5">
                <Button size="lg" w="full" type="primary" onPress={close}>
                  {intl.formatMessage({ id: 'action__i_got_it' })}
                </Button>
              </Center>
            </Center>
          </BottomSheetModal>
        ));
      }
    }
    main();
  }, [intl]);
  return (
    <Box flexDirection="row" mt="6">
      <Box mr="3">
        <Icon
          width={20}
          height={20}
          color="text-warning"
          name="ExclamationCircleOutline"
        />
      </Box>
      <Box flex="1">
        <Typography.Body2 color="text-warning">
          {intl.formatMessage({
            id: 'msg__you_will_swap_tokens_for_10%_less_than_coingecko_s_rate_which_may_result_in_a_loss',
          })}
        </Typography.Body2>
      </Box>
    </Box>
  );
};

const PriceImpactAlert = () => {
  const priceImpact = usePriceImpact();
  if (priceImpact && priceImpact > 10) {
    return <PriceImpactAlertContent />;
  }
  return null;
};

const SwapWarning: FC = () => (
  <>
    <ExchangeAddressAlert />
    <DepositLimitAlert />
    <RecipientAlert />
    <ErrorAlert />
    <PriceImpactAlert />
  </>
);

export default SwapWarning;
