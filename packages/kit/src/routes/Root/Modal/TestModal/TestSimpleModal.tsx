import { useCallback, useLayoutEffect } from 'react';

import { ModalContainer, Stack, Text } from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/components/src/Navigation';
import HeaderIconButton from '@onekeyhq/components/src/Navigation/Header/HeaderIconButton';

import type { ModalTestParamList } from './Routes';

export default function TestSimpleModal({
  navigation,
}: ModalScreenProps<ModalTestParamList>) {
  const headerRightCall = useCallback(
    () => <HeaderIconButton icon="AnonymousHidden2Outline" />,
    [],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: headerRightCall,
    });
  }, [navigation, headerRightCall]);

  return (
    <ModalContainer onConfirm={() => {}}>
      <Stack>
        <Text>这是一个普通的 Modal 测试</Text>
      </Stack>
    </ModalContainer>
  );
}
