import { useEffect } from 'react';

import IdentityAssertion from '../../components/IdentityAssertion';
import { useNavigation } from '../../hooks';

import Explorer from './Explorer';

export default function Discover() {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  return (
    <IdentityAssertion checkCompatibleNetwork={false}>
      <Explorer />
    </IdentityAssertion>
  );
}
