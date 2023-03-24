import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { useFrozenBalance } from '../../../hooks/useTokens';

type Props = { accountId: string; networkId: string; tokenId: string };

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

export function PreSendAmountAlert(props: Props) {
  const { networkId } = props;
  if (networkId === OnekeyNetwork.xmr) {
    return <XmrAlert {...props} />;
  }

  return null;
}
