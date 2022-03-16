import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import OnekeyLite, {
  NfcConnectUiState,
} from '@onekeyhq/app/src/hardware/OnekeyLite';
import {
  CallbackError,
  CardInfo,
} from '@onekeyhq/app/src/hardware/OnekeyLite/types';
import { ButtonType } from '@onekeyhq/components/src/Button';

import { useNavigation } from '../../../..';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useToast } from '../../../../hooks';
import { updateWallet } from '../../../../store/reducers/wallet';
import HardwareConnect, { OperateType } from '../../BaseConnect';
import ErrorDialog from '../ErrorDialog';
import { OnekeyLiteStackNavigationProp } from '../navigation';
import { OnekeyLiteModalRoutes, OnekeyLiteRoutesParams } from '../routes';

type NavigationProps = OnekeyLiteStackNavigationProp;
type RouteProps = RouteProp<
  OnekeyLiteRoutesParams,
  OnekeyLiteModalRoutes.OnekeyLiteBackupModal
>;
const Backup: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const { dispatch } = backgroundApiProxy;
  const { walletId, pwd, backupData, onRetry, onSuccess } =
    useRoute<RouteProps>().params;

  const [pinRetryCount, setPinRetryCount] = useState('');
  const [title] = useState('Onekey Lite');
  const [actionPressStyle, setActionPressStyle] =
    useState<ButtonType>('primary');
  const [actionPressContent, setActionPressContent] = useState(
    intl.formatMessage({ id: 'action__connect' }),
  );
  const [actionState, setActionState] = useState(
    intl.formatMessage({ id: 'title__place_your_card_as_shown_below' }),
  );
  const [actionDescription, setActionDescription] = useState(
    intl.formatMessage({ id: 'title__place_your_card_as_shown_below_desc' }),
  );
  const [operateType, setOperateType] = useState<OperateType>('guide');
  const [errorCode, setErrorCode] = useState(0);

  const stateNfcSearch = () => {
    setActionPressStyle('basic');
    setActionPressContent(intl.formatMessage({ id: 'action__cancel' }));
    setActionState(intl.formatMessage({ id: 'title__searching' }));
    setActionDescription(intl.formatMessage({ id: 'title__searching_desc' }));
    setOperateType('connect');
  };

  const stateNfcTransfer = () => {
    setActionPressStyle('basic');
    setActionPressContent(intl.formatMessage({ id: 'action__cancel' }));
    setActionState(intl.formatMessage({ id: 'title__transferring_data' }));
    setActionDescription(
      intl.formatMessage({ id: 'title__transferring_data_desc' }),
    );
    setOperateType('transfer');
  };

  const stateNfcComplete = () => {
    setActionPressStyle('primary');
    setActionPressContent(intl.formatMessage({ id: 'action__i_got_it' }));
    setActionState(intl.formatMessage({ id: 'title__backup_completed' }));
    setActionDescription(
      intl.formatMessage({
        id: 'title__backup_completed_desc',
      }),
    );
    setOperateType('complete');
  };

  const startNfcScan = (overwrite = false) => {
    if (backupData.trim() === '') {
      toast.info(intl.formatMessage({ id: 'msg__unknown_error' }));
      navigation.goBack();
      return;
    }

    stateNfcSearch();
    OnekeyLite.cancel();
    OnekeyLite.setMnemonic(
      backupData,
      pwd,
      async (error: CallbackError, data: boolean | null, state: CardInfo) => {
        console.log('state', state);
        if (data) {
          console.log('NFC read data:', data);
          stateNfcComplete();
          if (walletId) {
            const wallet =
              await backgroundApiProxy.engine.confirmHDWalletBackuped(walletId);
            if (!wallet || wallet?.backuped === false) return;

            dispatch(updateWallet(wallet));
          }
          onSuccess?.();
        } else if (error) {
          console.log('NFC read error', error);

          console.log('NFC read error code', error.code, error.message);
          setPinRetryCount(state?.pinRetryCount?.toString() ?? '0');
          setErrorCode(error.code);
        }
      },
      overwrite,
    );
  };

  const handleCloseConnect = () => {
    console.log('handleCloseConnect');
  };

  const handleActionPress = () => {
    switch (operateType) {
      case 'guide':
        startNfcScan();
        break;
      case 'connect':
      case 'transfer':
        if (Platform.OS === 'ios') return;
        OnekeyLite.cancel();
        navigation.goBack();
        break;

      default:
        navigation.goBack();
        break;
    }
  };

  const handlerNfcConnectState = (event: NfcConnectUiState) => {
    console.log('Onekey Lite Reset handler NfcConnectState', event);

    switch (event.code) {
      case 1:
        break;
      case 2:
        stateNfcTransfer();
        break;
      case 3:
        break;

      default:
        break;
    }
  };

  useEffect(() => {
    OnekeyLite.addConnectListener(handlerNfcConnectState);

    if (Platform.OS !== 'ios') {
      startNfcScan();
    }

    return () => {
      OnekeyLite.removeConnectListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <HardwareConnect
        title={title}
        connectType="ble"
        actionState={actionState}
        actionDescription={actionDescription}
        operateType={operateType}
        onCloseConnect={handleCloseConnect}
        onActionPress={handleActionPress}
        actionPressStyle={actionPressStyle}
        actionPressContent={actionPressContent}
      />
      <ErrorDialog
        code={errorCode}
        pinRetryCount={pinRetryCount}
        onRetry={() => {
          onRetry?.();
        }}
        onRetryConnect={() => {
          startNfcScan(true);
        }}
        onExit={() => {
          navigation.goBack();
        }}
        onIntoNfcSetting={() => {
          OnekeyLite.intoSetting();
          navigation.goBack();
        }}
        onDialogClose={() => setErrorCode(0)}
      />
    </>
  );
};

export default Backup;
