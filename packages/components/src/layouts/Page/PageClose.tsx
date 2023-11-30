import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Trigger } from '../../actions';

export function PageClose({ children }: PropsWithChildren<unknown>) {
  const navigation = useNavigation();

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return <Trigger onPress={handleClose}>{children}</Trigger>;
}
