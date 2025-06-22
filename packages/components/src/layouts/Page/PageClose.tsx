import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Trigger } from '../../actions';
import { useSafeAreaInsets } from '../../hooks';
import { Stack } from '../../primitives';
import { NavBackButton, NavCloseButton } from '../Navigation';

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

function PageCloseButtonBase({ children }: PropsWithChildren) {
  const { top } = useSafeAreaInsets();

  return (
    <Stack position="absolute" left="$5" top={top || '$5'} zIndex="$5">
      <PageClose>{children}</PageClose>
    </Stack>
  );
}

export function PageBackButton() {
  return (
    <PageCloseButtonBase>
      <NavBackButton />
    </PageCloseButtonBase>
  );
}

export function PageCloseButton() {
  return (
    <PageCloseButtonBase>
      <NavCloseButton />
    </PageCloseButtonBase>
  );
}
