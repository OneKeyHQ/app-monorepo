import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { Button, Center, ScrollView, Stack } from '@onekeyhq/components';

type SetProps = { size?: ComponentProps<typeof Button>['size'] };

const ButtonSet: FC<SetProps> = ({ size }) => (
  <Stack
    direction="row"
    space="2"
    mb="2"
    py="2"
    alignItems="center"
    flexWrap="wrap"
    justifyContent="center"
  >
    <Button
      isLoading
      type="primary"
      size={size}
      rightIconName="AcademicCapMini"
      mb="2"
    >
      Button
    </Button>
    <Button
      isDisabled
      type="primary"
      size={size}
      rightIconName="AcademicCapMini"
      mb="2"
    >
      Button
    </Button>
    <Button type="primary" size={size} leftIconName="AcademicCapMini" mb="2">
      Button
    </Button>
    <Button type="basic" size={size} rightIconName="AcademicCapMini" mb="2">
      Button
    </Button>
    <Button type="plain" size={size} rightIconName="AcademicCapMini" mb="2">
      Button
    </Button>
    <Button
      type="destructive"
      rightIconName="AcademicCapMini"
      size={size}
      mb="2"
    >
      Button
    </Button>
  </Stack>
);

const ButtonUsePromise = () => {
  const onPromise = useCallback(
    () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (Math.random() < 0.5) {
            resolve('OK');
          } else {
            reject();
          }
        }, 2000);
      }),
    [],
  );
  return (
    <Stack
      direction="row"
      space="2"
      mb="2"
      py="2"
      alignItems="center"
      flexWrap="wrap"
      justifyContent="center"
    >
      <Button
        type="primary"
        rightIconName="AcademicCapMini"
        size="xl"
        mb="2"
        onPromise={onPromise}
      >
        use Promise
      </Button>
      <Button
        type="primary"
        rightIconName="AcademicCapMini"
        size="xl"
        mb="2"
        isLoading={false}
        onPromise={onPromise}
      >
        use Promise(disabled by isLoading)
      </Button>
      <Button
        type="primary"
        rightIconName="AcademicCapMini"
        size="xl"
        mb="2"
        onPress={() => {}}
        onPromise={onPromise}
      >
        use Promise(disabled by onPress)
      </Button>
    </Stack>
  );
};

const Buttons = () => (
  <Center flex="1" bg="background-hovered">
    <ScrollView>
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <ButtonSet size="xs" />
        <ButtonSet size="sm" />
        <ButtonSet size="base" />
        <ButtonSet size="lg" />
        <ButtonSet size="xl" />
        <ButtonUsePromise />
      </Stack>
    </ScrollView>
  </Center>
);

export default Buttons;
