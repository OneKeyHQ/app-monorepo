import { useCallback } from 'react';

import { Column } from 'native-base';

import {
  Button,
  Center,
  Stack,
  Toast,
  ToastManager,
} from '@onekeyhq/components';

const ToastGallery = () => {
  const addToast = useCallback(() => {
    ToastManager.show({
      title: 'Hello World',
    });
  }, []);

  return (
    <Center flex="1" bg="background-hovered">
      <Stack
        direction={{
          base: 'column',
          md: 'row',
        }}
        space={10}
      >
        <Column space={5}>
          <Button type="primary" onPress={addToast}>
            打开 toast
          </Button>
        </Column>
        <Column space={5}>
          <Toast title="Default toast" />
          <Toast dismiss error title="Error toast" />
          <Toast
            title="This is a success status toast"
            status="success"
            description="description"
            dismiss
          />
        </Column>
      </Stack>
    </Center>
  );
};

export default ToastGallery;
