import { useLayoutEffect } from 'react';

import IdentityAssertion from '../../components/IdentityAssertion';
import { useNavigation } from '../../hooks';

import Explorer from './Explorer';

export default function Discover() {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  return (
    <IdentityAssertion>
      <Explorer />
    </IdentityAssertion>
  );
}
