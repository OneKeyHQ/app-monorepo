import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionPressItem } from '../SectionPressItem';

const JPush = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('jpush-react-native') as typeof import('jpush-react-native'))
      .default;

export function RegistrationID() {
  const [registrationID, setRegistrationID] = useState(
    'RegistrationID is empty',
  );
  useEffect(() => {
    if (!JPush) {
      return;
    }
    JPush.getRegistrationID((res) => {
      if (res.registerID) {
        setRegistrationID(res.registerID);
      }
    });
  }, []);
  return (
    <SectionPressItem
      icon="CodeOutline"
      copyable
      title={registrationID}
      subtitle="JPush RegistrationID"
    />
  );
}
