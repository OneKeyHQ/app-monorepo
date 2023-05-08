import { useNavigation } from '@react-navigation/native';
import { find } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, VStack } from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import type { Token, Tool } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks';
import { useTools } from '../../../hooks/redux';
import { MainRoutes, RootRoutes, TabRoutes } from '../../../routes/routesEnum';
import { setHomeTabName } from '../../../store/reducers/status';
import { openUrl } from '../../../utils/openUrl';
import { EditableNonceStatusEnum } from '../types';

export function SendConfirmErrorsAlert({
  networkId,
  accountAddress,
  nativeToken,
  isWatchingAccount,
  balanceInsufficient,
  isNetworkNotMatched,
  isAccountNotMatched,
  editableNonceStatus,
  isNetworkBusy,
  isPendingTxSameNonce,
  isPendingTxSameNonceWithLowerGas,
  isLowMaxFee,
  pendingTxCount,
}: {
  networkId?: string;
  accountAddress?: string;
  nativeToken?: Token;
  isWatchingAccount?: boolean;
  balanceInsufficient?: boolean;
  isNetworkNotMatched?: boolean;
  isAccountNotMatched?: boolean;
  isNetworkBusy?: boolean;
  isPendingTxSameNonce?: boolean;
  isPendingTxSameNonceWithLowerGas?: boolean;
  editableNonceStatus?: EditableNonceStatusEnum;
  isLowMaxFee?: boolean;
  pendingTxCount?: string;
}) {
  const errors = [];
  const intl = useIntl();
  const navigation = useNavigation();

  const tools = useTools(networkId);

  const { network } = useNetwork({ networkId });

  if (isAccountNotMatched) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        message={intl.formatMessage({
          id: 'msg__mismatched_account',
        })}
      />,
    );
  }
  if (isNetworkNotMatched) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        message={intl.formatMessage({
          id: 'msg__mismatched_networks',
        })}
      />,
    );
  }
  if (isWatchingAccount) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        message={intl.formatMessage({
          id: 'form__error_trade_with_watched_acocunt',
        })}
      />,
    );
  }
  if (balanceInsufficient) {
    const gasShop = find(tools, { title: 'GasShop' }) as Tool;
    errors.push(
      <FormErrorMessage
        isAlertStyle
        action={
          gasShop?.link ? intl.formatMessage({ id: 'action__buy' }) : undefined
        }
        onAction={() => {
          if (gasShop && gasShop.link) {
            openUrl(gasShop.link.replace('{address}', accountAddress ?? ''));
          }
        }}
        message={intl.formatMessage(
          { id: 'msg__str_is_required_for_network_fees_top_up_str_to_make_tx' },
          {
            0: nativeToken?.symbol ?? '',
            1: network?.name ?? '',
          },
        )}
      />,
    );
  }

  if (
    !isPendingTxSameNonceWithLowerGas &&
    !isPendingTxSameNonce &&
    editableNonceStatus === EditableNonceStatusEnum.Less
  ) {
    errors.push(
      <FormErrorMessage
        alertType="warn"
        isAlertStyle
        message={intl.formatMessage({
          id: 'msg__nonce_has_been_used_and_may_cause_this_transaction_to_fail',
        })}
      />,
    );
  }

  if (editableNonceStatus === EditableNonceStatusEnum.Greater) {
    errors.push(
      <FormErrorMessage
        alertType="warn"
        isAlertStyle
        message={intl.formatMessage({
          id: 'msg__nonce_is_higher_means_the_tx_will_queued_until_tx_before_are_confirmed',
        })}
      />,
    );
  }

  if (isPendingTxSameNonceWithLowerGas) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        alertType="warn"
        message={intl.formatMessage({
          id: 'msg__transaction_with_the_same_nonce_already_exist_please_pay_a_higher_network_fee_otherwise_the_transaction_may_fail',
        })}
      />,
    );
  }

  if (
    !isPendingTxSameNonceWithLowerGas &&
    editableNonceStatus !== EditableNonceStatusEnum.Less &&
    isLowMaxFee
  ) {
    errors.push(
      <FormErrorMessage
        alertType="warn"
        isAlertStyle
        message={intl.formatMessage({
          id: 'msg__eth_tx_warning_future_tx_will_queue',
        })}
      />,
    );
  }

  if (pendingTxCount && pendingTxCount !== '0') {
    errors.push(
      <FormErrorMessage
        alertType="info"
        isAlertStyle
        message={intl.formatMessage(
          { id: 'msg__eth_tx_warning_tx_will_be_queued_str' },
          { 'number': pendingTxCount },
        )}
        action={intl.formatMessage({ id: 'action__view' })}
        onAction={() => {
          backgroundApiProxy.dispatch(setHomeTabName('History'));
          navigation?.navigate(RootRoutes.Main, {
            screen: MainRoutes.Tab,
            params: {
              screen: TabRoutes.Home,
            },
          });
        }}
      />,
    );
  }
  if (isNetworkBusy) {
    errors.push(
      <FormErrorMessage
        alertType="info"
        isAlertStyle
        message={intl.formatMessage({
          id: 'msg__eth_tx_warning_network_busy_gas_is_high',
        })}
      />,
    );
  }

  if (!errors || !errors.length) {
    return null;
  }
  return (
    <VStack testID="SendConfirmErrorsAlert" space={2} pb={4}>
      {errors.map((err, idx) => (
        <Box key={idx}>{err}</Box>
      ))}
    </VStack>
  );
}
