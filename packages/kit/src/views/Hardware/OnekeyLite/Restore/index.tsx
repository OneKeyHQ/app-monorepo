import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { DrawerActions, TabActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import OnekeyLite, {
  NfcConnectUiState,
} from '@onekeyhq/app/src/hardware/OnekeyLite';
import {
  CallbackError,
  CardErrors,
  CardInfo,
} from '@onekeyhq/app/src/hardware/OnekeyLite/types';
import { ButtonType } from '@onekeyhq/components/src/Button';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalScreenProps,
  TabRoutes,
  TabRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import { Atom } from '../../../../utils/helper';
import HardwareConnect, { OperateType } from '../../BaseConnect';
import ErrorDialog from '../ErrorDialog';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

type TabNavigationProps = ModalScreenProps<TabRoutesParams>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.OnekeyLiteRestoreModal
>;

const Restore: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const tabNavigation = useNavigation<TabNavigationProps['navigation']>();

  const { pinCode } = useRoute<RouteProps>().params;
  const [pinRetryCount, setPinRetryCount] = useState<string>('');
  const [restoreData, setRestoreData] = useState<string>();

  const [title] = useState(
    intl.formatMessage({ id: 'app__hardware_name_onekey_lite' }),
  );
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

  const goBack = () => {
    const inst = navigation.getParent() || navigation;
    inst.goBack();
  };

  const goBackHome = () => {
    tabNavigation.navigate(TabRoutes.Home);
    tabNavigation.dispatch(TabActions.jumpTo(TabRoutes.Home, {}));
    tabNavigation.dispatch(DrawerActions.openDrawer());
  };

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
    setActionPressContent(intl.formatMessage({ id: 'action__continue' }));
    setActionState(intl.formatMessage({ id: 'title__nfc_data_has_been_read' }));
    setActionDescription(
      intl.formatMessage({
        id: 'title__nfc_data_has_been_read_desc',
      }),
    );
    setOperateType('complete');
  };

  const stateNfcDone = () => {
    ('primary');

    setActionPressContent(intl.formatMessage({ id: 'action__go_to_view' }));
    setActionState(intl.formatMessage({ id: 'title__recovery_completed' }));
    setActionDescription(
      intl.formatMessage({
        id: 'title__recovery_completed_desc',
      }),
    );
    setOperateType('done');
  };

  const startNfcScan = () => {
    stateNfcSearch();
    OnekeyLite.cancel();
    console.log('Atom.AppState.lock()');
    // appState will emit active event when OnekeyLite.getMnemonicWithPin throw error
    // so we add AppState Lock to bypass the wrong event
    Atom.AppState.lock();
    OnekeyLite.getMnemonicWithPin(
      pinCode,
      (error: CallbackError, data: string | null, state: CardInfo) => {
        console.log('Atom.AppState.release()');
        Atom.AppState.release();
        console.log('state', state);
        if (data) {
          setRestoreData(data);
          stateNfcComplete();
          navigation.navigate(
            CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal,
            {
              mnemonic: data,
              onSuccess: () => {
                stateNfcDone();
              },
            },
          );
        } else if (error) {
          console.log('NFC read error', error);

          console.log('NFC read error code', error.code, error.message);
          setPinRetryCount(state?.pinRetryCount?.toString() ?? '0');
          setErrorCode(error.code);
        } else {
          setErrorCode(CardErrors.ExecFailure);
        }
      },
    );
  };

  useEffect(
    () => () => {
      // release lock when exiting page
      console.log('Atom.AppState.release() when exit page');
      Atom.AppState.release();
    },
    [],
  );

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
        goBack();
        break;

      case 'complete':
        if (!restoreData) return;
        navigation.navigate(
          CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal,
          {
            mnemonic: restoreData,
            onSuccess: () => {
              stateNfcDone();
            },
          },
        );
        break;

      case 'done':
        goBackHome();
        break;

      default:
        goBack();
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
        onRetryConnect={() => startNfcScan()}
        onRetry={() =>
          navigation.replace(
            CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal,
          )
        }
        onExit={() => {
          goBack();
        }}
        onDialogClose={() => setErrorCode(0)}
        onIntoNfcSetting={() => {
          OnekeyLite.intoSetting();
          goBack();
        }}
      />
    </>
  );
};

export default Restore;
