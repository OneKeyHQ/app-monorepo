import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useFrozenBalance } from '../../../hooks/useTokens';

import type { MessageDescriptor } from 'react-intl';

type Props = {
  accountId: string;
  networkId: string;
  tokenId: string;
  amount: string;
};

export function XmrAlert({ accountId, networkId, tokenId }: Props) {
  const intl = useIntl();
  const frozenBalance = useFrozenBalance({ accountId, networkId, tokenId });
  return new BigNumber(frozenBalance).isNegative() ? (
    <Box mb={2}>
      <Alert
        dismiss={false}
        title={intl.formatMessage({
          id: 'msg__the_spendable_balance_on_the_chain_will_be_0_when_a_transfer_in_in_progress',
        })}
        alertType="warn"
      />
    </Box>
  ) : null;
}

export function LightningNetworkAlert({
  accountId,
  networkId,
  amount,
}: {
  accountId: string;
  networkId: string;
  amount: string;
}) {
  const intl = useIntl();
  const [invalidAmountError, setInvalidAmountError] = useState<{
    key: MessageDescriptor['id'];
    info: any;
  } | null>(null);
  const validateAmount = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceLightningNetwork.validateZeroInvoiceMaxSendAmount(
        {
          accountId,
          networkId,
          amount,
        },
      );
      return { result: true, errorInfo: null };
    } catch (error: any) {
      const { key, info } = error;
      return {
        result: false,
        errorInfo: { key: key as MessageDescriptor['id'], info },
      };
    }
  }, [accountId, networkId, amount]);
  useEffect(() => {
    const validFunc = async () => {
      const { result, errorInfo } = await validateAmount();
      setInvalidAmountError(result ? null : errorInfo);
    };
    validFunc();
  }, [validateAmount]);
  return (
    <Box mb={2}>
      {invalidAmountError ? (
        <Alert
          dismiss={false}
          title={intl.formatMessage(
            { id: invalidAmountError.key },
            { ...invalidAmountError.info },
          )}
          alertType="error"
        />
      ) : (
        <Alert
          dismiss={false}
          title={intl.formatMessage({
            id: 'msg__the_invoice_does_not_specify_a_amount_pay_attention_to_avoid_overpayment',
          })}
          alertType="warn"
        />
      )}
    </Box>
  );
}

export function PreSendAmountAlert(props: Props) {
  const { networkId, accountId, amount } = props;
  if (networkId === OnekeyNetwork.xmr) {
    return <XmrAlert {...props} />;
  }

  if (isLightningNetworkByNetworkId(networkId)) {
    return (
      <LightningNetworkAlert
        networkId={networkId}
        accountId={accountId}
        amount={amount}
      />
    );
  }

  return null;
}
