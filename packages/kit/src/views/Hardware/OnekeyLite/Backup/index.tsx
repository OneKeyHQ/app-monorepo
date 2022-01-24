import React, { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { useNavigation } from '../../../..';
import HardwareConnect from '../../BaseConnect';
import { OnekeyLiteStackNavigationProp } from '../navigation';
import { OnekeyLiteModalRoutes } from '../routes';

type NavigationProps = OnekeyLiteStackNavigationProp;

const Backup: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const [title] = useState(intl.formatMessage({ id: 'title__searching' }));
  const [pwd, setPwd] = useState('');

  useEffect(() => {
    if (!pwd) {
      navigation.navigate(OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal, {
        callBack: (inputPwd) => {
          setPwd(inputPwd);
          console.log(inputPwd);
          return false;
        },
      });
    }
  }, [navigation, pwd]);

  return <HardwareConnect title={title} connectType="ble" />;
};

export default Backup;
