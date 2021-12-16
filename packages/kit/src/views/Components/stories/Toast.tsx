import React, { useCallback, useRef } from 'react';

import { Button, Center, Stack, useToast } from '@onekeyhq/components';

const ToastGallery = () => {
  const toast = useToast();
  const toastIdRef = useRef<string>();

  const close = useCallback(() => {
    if (toastIdRef.current) {
      toast.close(toastIdRef.current);
    }
  }, [toast]);

  const addToast = useCallback(() => {
    toastIdRef.current = toast.show({
      title: 'Hello OneKey Wallet!',
    }) as string;
  }, [toast]);

  return (
    <Center flex="1" bg="background-hovered">
      <Stack
        direction={{
          base: 'column',
          md: 'row',
        }}
        space={2}
      >
        <Button type="primary" onPress={addToast}>
          打开 toast
        </Button>
        <Button type="primary" onPress={close}>
          关闭最后一个
        </Button>
        <Button type="primary" onPress={toast.closeAll}>
          关闭所有
        </Button>
      </Stack>
    </Center>
  );
};

export default ToastGallery;
