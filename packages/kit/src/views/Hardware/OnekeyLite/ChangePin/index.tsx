import React, { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { useNavigation } from '../../../..';
import HardwareConnect from '../../BaseConnect';
import { OnekeyLiteStackNavigationProp } from '../navigation';
import { OnekeyLiteModalRoutes } from '../routes';

type NavigationProps = OnekeyLiteStackNavigationProp;

type ChangePinProcess =
  | 'input_current_pin'
  | 'input_new_pin'
  | 'input_repeat_pin'
  | 'nfc_write';

const ChangePin: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const [title] = useState(intl.formatMessage({ id: 'title__searching' }));
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [optionProcess, setOptionProcess] =
    useState<ChangePinProcess>('input_current_pin');

  const writeNFC = () => {
    console.log(
      `Change pin success:  oldPwd:${currentPwd} currentPwd:${newPwd}`,
    );
  };

  useEffect(() => {
    switch (optionProcess) {
      case 'input_current_pin':
        navigation.navigate(
          OnekeyLiteModalRoutes.OnekeyLitePinCodeCurrentModal,
          {
            callBack: (inputPwd) => {
              setCurrentPwd(inputPwd);
              setOptionProcess('input_new_pin');
              return false;
            },
          },
        );
        break;
      case 'input_new_pin':
        navigation.navigate(OnekeyLiteModalRoutes.OnekeyLitePinCodeSetModal, {
          callBack: (inputPwd) => {
            setNewPwd(inputPwd);
            setOptionProcess('input_repeat_pin');
            return false;
          },
        });
        break;
      case 'input_repeat_pin':
        navigation.navigate(
          OnekeyLiteModalRoutes.OnekeyLitePinCodeRepeatModal,
          {
            callBack: (inputPwd) => {
              if (inputPwd === newPwd) {
                setOptionProcess('nfc_write');
              }
              return false;
            },
          },
        );
        break;
      case 'nfc_write':
        writeNFC();
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, optionProcess]);

  return <HardwareConnect title={title} connectType="ble" />;
};

export default ChangePin;
