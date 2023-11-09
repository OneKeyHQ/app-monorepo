import { useCallback, useLayoutEffect } from 'react';

import { ModalContainer, Stack, Text } from '@onekeyhq/components';
import type { IModalScreenProps } from '@onekeyhq/components/src/Navigation';
import HeaderIconButton from '@onekeyhq/components/src/Navigation/Header/HeaderIconButton';

import type { IModalTestParamList } from './Routes';

export default function TestSimpleModal({
  navigation,
}: IModalScreenProps<IModalTestParamList>) {
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
