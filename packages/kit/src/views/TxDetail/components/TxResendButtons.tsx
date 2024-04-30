import BigNumber from 'bignumber.js';
import { cloneDeep, isNil, isNumber } from 'lodash';
import { useIntl } from 'react-intl';

import { Button, Dialog, ToastManager } from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { showDialog } from '../../../utils/overlayUtils';
import { SendModalRoutes } from '../../Send/enums';

import type { TransactionDetailRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type {
  SendConfirmActionType,
  SendConfirmParams,
} from '../../Send/types';
import type { NavigationProp } from '@react-navigation/native';

export type HistoryListViewNavigationProp =
  ModalScreenProps<TransactionDetailRoutesParams>;

/*
const history = await $$simpleDb.history.getRawData();

const tx = history.items.find(item=>item.decodedTx.txid==='0x298dd2b73043d86922fed0baf59f6b32137cb08ab798699c80f3a14a8b87618c');

tx.decodedTx.encodedTx.to='0x11111111';

$$simpleDb.history.setRawData(history);
 */

function SpeedUpOrCancelTxDialog({ onClose }: { onClose?: () => void }) {
  const intl = useIntl();
  return (
    <Dialog
      visible
      contentProps={{
        iconType: 'success',
        iconName: 'ArrowUpOutline',
        title: intl.formatMessage({ id: 'modal__unable_to_accelerate' }),
        content: intl.formatMessage({ id: 'modal__unable_to_accelerate_desc' }),
      }}
      footerButtonProps={{
        hideSecondaryAction: true,
        onPrimaryActionPress: () => {
          onClose?.();
        },
        primaryActionTranslationId: 'action__i_got_it',
      }}
    />
  );
}

// TODO move to service and use updateEncodedTx()
async function doSpeedUpOrCancelTx(props: {
  historyTx: IHistoryTx;
  actionType: SendConfirmActionType;
  navigation: NavigationProp<any>;
}) {
  const { historyTx, actionType, navigation } = props;
  const encodedTx = (historyTx.decodedTx?.encodedTx ?? {}) as IEncodedTxEvm;
  const encodedTxEncrypted = historyTx?.decodedTx?.encodedTxEncrypted;
  let encodedTxOrigin: IEncodedTxEvm | undefined;
  if (encodedTxEncrypted) {
    try {
      encodedTxOrigin = JSON.parse(
        await backgroundApiProxy.servicePassword.decryptByInstanceId(
          encodedTxEncrypted,
        ),
      );
    } catch (error) {
      console.error(error);
      encodedTxOrigin = {
        from: '-',
        to: '-',
        value: '-',
        data: '-',
      };
    }
  }
  const { nonce, accountId, networkId } = historyTx.decodedTx;
  if (isNil(nonce) || !isNumber(nonce) || nonce < 0) {
    console.error('speedUpOrCancelTx ERROR: nonce is missing!');
    return;
  }

  // set only fields of IEncodedTxEvm
  const encodedTxEvm: IEncodedTxEvm = {
    from: encodedTx.from,
    to: encodedTx.to,
    value: encodedTx.value,
    data: encodedTx.data,
    // must be number, 0x string will send new tx
    nonce,

    // keep origin fee info
    gas: encodedTx.gas,
    gasLimit: encodedTx.gasLimit,
    gasPrice: encodedTx.gasPrice,
    maxFeePerGas: encodedTx.maxFeePerGas,
    maxPriorityFeePerGas: encodedTx.maxPriorityFeePerGas,
  };
  if (actionType === 'cancel') {
    encodedTxEvm.to = encodedTxEvm.from;
    encodedTxEvm.value = '0x0';
    encodedTxEvm.data = '0x';
  }
  if (actionType === 'speedUp') {
    if (
      encodedTxOrigin &&
      (encodedTxOrigin.from !== encodedTxEvm.from ||
        encodedTxOrigin.to !== encodedTxEvm.to ||
        encodedTxOrigin.value !== encodedTxEvm.value ||
        encodedTxOrigin.data !== encodedTxEvm.data ||
        !new BigNumber(encodedTxEvm.nonce || '0').eq(
          encodedTxOrigin.nonce || '0',
        ))
    ) {
      ToastManager.show(
        { title: 'Speedup failed. History transaction data not matched' },
        { type: 'error' },
      );
      debugLogger.sendTx.info(
        'Speedup failed. History transaction data not matched',
        {
          encodedTxOrigin,
          encodedTxEvm,
        },
      );
      return;
    }
  }

  const isEarliestPendingTx =
    await backgroundApiProxy.serviceTransaction.isEarliestPendingTx({
      accountId,
      networkId,
      encodedTx: encodedTxEvm,
    });

  if (!isEarliestPendingTx) {
    showDialog(<SpeedUpOrCancelTxDialog />);
    return;
  }

  const params: SendConfirmParams = {
    accountId,
    networkId,
    // actionType2: '',
    actionType,
    resendActionInfo: {
      type: actionType,
      replaceHistoryId: historyTx.id,
    },
    encodedTx: encodedTxEvm,
    feeInfoEditable: true,
    feeInfoUseFeeInTx: true,
    ignoreFetchFeeCalling: true,
  };
  navigation.navigate(RootRoutes.Modal, {
    screen: ModalRoutes.Send,
    params: {
      screen: SendModalRoutes.SendConfirm,
      params: cloneDeep(params),
    },
  });
}

export function TxResendButtons(props: { historyTx: IHistoryTx }) {
  const { historyTx } = props;
  const navigation =
    useNavigation<HistoryListViewNavigationProp['navigation']>();
  const intl = useIntl();
  const isCancel = historyTx.replacedType === 'cancel';

  return (
    <>
      {!isCancel ? (
        <Button
          size="sm"
          ml={2}
          onPress={() => {
            doSpeedUpOrCancelTx({
              historyTx,
              actionType: 'cancel',
              navigation,
            });
          }}
        >
          {intl.formatMessage({ id: 'action__cancel' })}
        </Button>
      ) : null}

      <Button
        type="primary"
        size="sm"
        ml={2}
        onPress={() => {
          if (isCancel) {
            doSpeedUpOrCancelTx({
              historyTx,
              actionType: 'cancel',
              navigation,
            });
          } else {
            doSpeedUpOrCancelTx({
              historyTx,
              actionType: 'speedUp',
              navigation,
            });
          }
        }}
      >
        {intl.formatMessage({ id: 'action__speed_up' })}
      </Button>
    </>
  );
}
