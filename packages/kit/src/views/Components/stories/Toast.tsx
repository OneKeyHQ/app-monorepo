import React, { useCallback, useRef } from 'react';

import { Column } from 'native-base';

import { Button, Center, Stack, Toast, useToast } from '@onekeyhq/components';

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
      render: () => (
        <Toast
          title="Hello world!"
          status="danger"
          description="Failure to add 2.3245 BNB to CAKE/WBNB."
          dismiss
        />
      ),
    }) as string;
  }, [toast]);

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
          <Button type="primary" onPress={close}>
            关闭最后一个
          </Button>
          <Button type="primary" onPress={toast.closeAll}>
            关闭所有
          </Button>
        </Column>
        <Column space={5} flex="content">
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
