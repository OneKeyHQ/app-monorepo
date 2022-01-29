import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';

import { Box } from '@onekeyhq/components';

import { useNavigation } from '../../../..';
import { OnekeyLiteStackNavigationProp } from '../navigation';
import { OnekeyLiteModalRoutes, OnekeyLiteRoutesParams } from '../routes';

type ChangePinProcess =
  | 'input_current_pin'
  | 'input_new_pin'
  | 'input_repeat_pin'
  | 'done';

type NavigationProps = OnekeyLiteStackNavigationProp;

const ChangePinInputPin: FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const route =
    useRoute<
      RouteProp<
        OnekeyLiteRoutesParams,
        OnekeyLiteModalRoutes.OnekeyLitePinCodeChangePinModal
      >
    >();

  const { callBack } = route.params;

  const [optionProcess, setOptionProcess] =
    useState<ChangePinProcess>('input_current_pin');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  useEffect(() => {
    switch (optionProcess) {
      case 'input_current_pin':
        navigation.push(OnekeyLiteModalRoutes.OnekeyLitePinCodeCurrentModal, {
          callBack: (inputPwd) => {
            setCurrentPwd(inputPwd);
            setOptionProcess('input_new_pin');
            return false;
          },
        });
        break;
      case 'input_new_pin':
        navigation.push(OnekeyLiteModalRoutes.OnekeyLitePinCodeSetModal, {
          callBack: (inputPwd) => {
            setNewPwd(inputPwd);
            setOptionProcess('input_repeat_pin');
            return false;
          },
        });
        break;
      case 'input_repeat_pin':
        navigation.push(OnekeyLiteModalRoutes.OnekeyLitePinCodeRepeatModal, {
          callBack: (inputPwd) => {
            if (inputPwd === newPwd) {
              setOptionProcess('done');
            }
            return false;
          },
        });
        break;
      default:
        navigation.goBack();
        callBack?.(currentPwd, newPwd);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, optionProcess]);

  return <Box />;
};

export default ChangePinInputPin;
