import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
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
import { useNavigation } from '@onekeyhq/kit/src';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalScreenProps,
  TabRoutes,
  TabRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

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
  const { serviceApp } = backgroundApiProxy;
  const toast = useToast();

  const { pwd, onRetry } = useRoute<RouteProps>().params;
  const [pinRetryCount, setPinRetryCount] = useState<string>('');
  const [restoreData, setRestoreData] = useState<string>();

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
    setActionState(intl.formatMessage({ id: 'title__recovery_completed' }));
    setActionDescription(
      intl.formatMessage({
        id: 'title__backup_completed_desc',
      }),
    );
    setOperateType('complete');
  };

  const stateNfcDone = () => {
    setActionPressStyle('primary');
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
    OnekeyLite.getMnemonicWithPin(
      pwd,
      (error: CallbackError, data: string | null, state: CardInfo) => {
        console.log('state', state);
        if (data) {
          setRestoreData(data);
          stateNfcComplete();
          navigation.navigate(
            CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal,
            {
              onSuccess: async (password) => {
                try {
                  await serviceApp.createHDWallet({
                    password,
                    mnemonic: data.trim(),
                  });

                  stateNfcDone();
                } catch (e) {
                  console.log('error', e);
                  toast.info(intl.formatMessage({ id: 'msg__unknown_error' }));
                  navigation.goBack();
                }
              },
              onCancel: () => {
                navigation.goBack();
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

      case 'complete':
        if (!restoreData) return;
        navigation.navigate(
          CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal,
          {
            onSuccess: async (password) => {
              try {
                await serviceApp.createHDWallet({
                  password,
                  mnemonic: restoreData.trim(),
                });

                stateNfcDone();
              } catch (e) {
                console.log('error', e);
                toast.info(intl.formatMessage({ id: 'msg__unknown_error' }));
                navigation.goBack();
              }
            },
            onCancel: () => {
              navigation.goBack();
            },
          },
        );
        break;

      case 'done':
        goBackHome();
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
        onRetryConnect={() => startNfcScan()}
        onRetry={() => onRetry?.()}
        onExit={() => {
          navigation.goBack();
        }}
        onDialogClose={() => setErrorCode(0)}
        onIntoNfcSetting={() => {
          OnekeyLite.intoSetting();
          navigation.goBack();
        }}
      />
    </>
  );
};

export default Restore;
