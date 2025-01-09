import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Trigger } from '../../actions';

export function PageClose({
  children,
  disabled,
}: PropsWithChildren<{
  disabled?: boolean;
}>) {
  const navigation = useNavigation();

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <Trigger onPress={handleClose} disabled={disabled}>
      {children}
    </Trigger>
  );
}
