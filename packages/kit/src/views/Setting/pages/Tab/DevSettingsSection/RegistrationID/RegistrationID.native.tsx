import { useEffect, useState } from 'react';

import JPush from 'jpush-react-native';

import { SectionPressItem } from '../SectionPressItem';

export function RegistrationID() {
  const [registrationID, setRegistrationID] = useState(
    'RegistrationID is empty',
  );
  useEffect(() => {
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
      subtitle="RegistrationID"
    />
  );
}
