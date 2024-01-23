import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  BottomSheetModal,
  Box,
  Button,
  Center,
  Typography,
} from '@onekeyhq/components';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useCreateAccountInWallet } from '../../../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNetworkSimple,
} from '../../../../hooks';
import { appSelector } from '../../../../store';
import { showOverlay } from '../../../../utils/overlayUtils';
import { useInputLimitsError, useSwapRecipient } from '../../hooks/useSwap';
import { usePriceImpact, useSwapSlippage } from '../../hooks/useSwapUtils';
import { SwapError } from '../../typings';

const RecipientBox = () => {
  const intl = useIntl();
  const ref = useRef<boolean>(false);
  const { wallet } = useActiveWalletAccount();
  const accounts = useAppSelector((s) => s.runtime.accounts);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const network = useNetworkSimple(outputToken?.networkId);
  const { createAccount } = useCreateAccountInWallet({
    networkId: outputToken?.networkId,
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
    async function main() {
      if (ref.current) {
        const item = appSelector((s) => s.swap.outputToken);
        if (item) {
          const data = await backgroundApiProxy.engine.getNetwork(
            item.networkId,
          );
          backgroundApiProxy.serviceSwap.setRecipientByNetwork(data);
        }
        if (!ref.current) {
          ref.current = true;
        }
      }
    }
    main();
  }, [accounts]);

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
        action={intl.formatMessage({ id: 'action__create' })}
        onAction={createAccount}
        dismiss={false}
      />
    </Box>
  ) : null;
};

const RecipientAlert = () => {
  const recipient = useSwapRecipient();

  if (recipient) {
    return null;
  }

  return <RecipientBox />;
};

const DepositLimitAlert = () => {
  const limitsError = useInputLimitsError();
  const loading = useAppSelector((s) => s.swap.loading);
  const intl = useIntl();
  const onAction = useCallback(() => {
    if (limitsError?.value) {
      backgroundApiProxy.serviceSwap.userInput('INPUT', limitsError.value);
    }
  }, [limitsError]);
  if (limitsError && !loading) {
    return (
      <Box mt="6">
        <Alert
          title={limitsError.message}
          alertType="warn"
          dismiss={false}
          onAction={onAction}
          action={intl.formatMessage({ id: 'action__fill_in' })}
        />
      </Box>
    );
  }
  return null;
};

const PriceUnknownAlertContent = () => {
  const intl = useIntl();

  const onRefresh = useCallback(() => {
    appUIEventBus.emit(AppUIEventBusNames.SwapRefresh);
  }, []);

  return (
    <Box mt="6">
      <Alert
        title={intl.formatMessage({
          id: 'msg__failed_to_fetch_quotes',
        })}
        alertType="warn"
        action={intl.formatMessage({ id: 'action__retry' })}
        onAction={onRefresh}
        dismiss={false}
      />
    </Box>
  );
};

const NotSupportAlertContent = () => {
  const intl = useIntl();
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
};

const ErrorAlert = () => {
  const error = useAppSelector((s) => s.swap.error);
  if (error === SwapError.NotSupport) {
    return <NotSupportAlertContent />;
  }
  if (error === SwapError.QuoteFailed) {
    return <PriceUnknownAlertContent />;
  }
  return null;
};

const ExchangeAddressAlertContent = () => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" mt="6" w="full">
      <Alert
        alertType="warn"
        dismiss={false}
        containerProps={{ width: 'full' }}
        title={intl.formatMessage({
          id: 'content__do_not_swap_directly_to_the_exchange',
        })}
        description={intl.formatMessage({
          id: 'content__do_not_swap_directly_to_the_exchange_desc',
        })}
      />
    </Box>
  );
};

const ExchangeAddressAlert = () => {
  const [recipientUnknown, setRecipientUnknown] = useState<boolean>(false);
  const recipient = useSwapRecipient();
  useEffect(() => {
    backgroundApiProxy.serviceSwap
      .recipientIsUnknown(recipient)
      .then(setRecipientUnknown);
  }, [recipient]);
  return recipientUnknown ? <ExchangeAddressAlertContent /> : null;
};

type PriceImpactAlertContentProps = { value: number };
const PriceImpactAlertContent: FC<PriceImpactAlertContentProps> = ({
  value,
}) => {
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
                {intl.formatMessage(
                  {
                    id: 'msg__you_will_swap_tokens_for_10%_less_than_coingecko_s_rate_which_may_result_in_a_loss',
                  },
                  { '0': value.toFixed(2) },
                )}
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
  }, [intl, value]);
  return (
    <Box flexDirection="row" mt="6">
      <Alert
        alertType="warn"
        dismiss={false}
        containerProps={{ width: 'full' }}
        title={intl.formatMessage(
          {
            id: 'msg__you_will_swap_tokens_for_10%_less_than_coingecko_s_rate_which_may_result_in_a_loss',
          },
          { '0': value.toFixed(2) },
        )}
      />
    </Box>
  );
};

const PriceImpactAlert = () => {
  const priceImpact = usePriceImpact();
  if (priceImpact && priceImpact > 10) {
    return <PriceImpactAlertContent value={priceImpact} />;
  }
  return null;
};

type SlippageAlertContentProps = {
  value: string;
};

const SlippageAlertContent: FC<SlippageAlertContentProps> = ({ value }) => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" mt="6" w="full">
      <Alert
        containerProps={{ width: 'full' }}
        alertType="warn"
        dismiss={false}
        title={intl.formatMessage(
          {
            id: 'msg__current_slippage_str_is_high',
          },
          { '0': `${value}%` },
        )}
        description={intl.formatMessage({
          id: 'msg__your_trade_may_be_front_run_due_to_the_larger_slippage',
        })}
      />
    </Box>
  );
};

const SlippageAlert = () => {
  const quote = useAppSelector((s) => s.swap.quote);
  const slippage = useSwapSlippage();
  if (quote && slippage.mode === 'custom') {
    const num = Number(slippage.value);
    if (!Number.isNaN(num) && num >= 5 && num < 50) {
      return <SlippageAlertContent value={slippage.value} />;
    }
  }
  return null;
};

export const SwapAlert: FC = () => (
  <>
    <ExchangeAddressAlert />
    <DepositLimitAlert />
    <RecipientAlert />
    <ErrorAlert />
    <PriceImpactAlert />
    <SlippageAlert />
  </>
);
