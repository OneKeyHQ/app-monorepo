import { useEffect, useState } from 'react';

import JPush from 'jpush-react-native';

import { SectionPressItem } from '../SectionPressItem';

export function RegistrationID() {
  const [registrationID, setRegistrationID] = useState('');
  useEffect(() => {
    JPush.getRegistrationID((res) => {
      setRegistrationID(res.registerID);
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
