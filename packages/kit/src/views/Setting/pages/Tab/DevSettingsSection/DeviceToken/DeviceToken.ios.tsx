import { useEffect, useState } from 'react';

import LaunchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager/LaunchOptionsManager';

import { SectionPressItem } from '../SectionPressItem';

export function DeviceToken() {
  const [deviceToken, setDeviceToken] = useState('DeviceToken is empty');
  useEffect(() => {
    void LaunchOptionsManager.getDeviceToken().then((token) => {
      if (token) {
        setDeviceToken(token);
      }
    });
  }, []);
  return (
    <SectionPressItem
      icon="CodeOutline"
      copyable
      title={deviceToken}
      subtitle="iOS DeviceToken"
    />
  );
}
