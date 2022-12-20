import { useState } from 'react';

import {
  Center,
  Pressable,
  Select,
  Spinner,
  Stack,
  Typography,
} from '@onekeyhq/components';

const Select1 = () => {
  const [value, setValue] = useState('https://rpc.onekey.so/eth');
  return (
    <Select
      onChange={(v) => setValue(v)}
      value={value}
      footer={null}
      containerProps={{
        width: '280px',
        zIndex: 5,
      }}
      defaultValue="https://rpc.onekey.so/eth"
      options={[
        {
          label: 'https://rpc.onekey.so/eth',
          value: 'https://rpc.onekey.so/eth',
        },
        {
          label: 'https://google.com',
          value: 'https://google.com',
        },
        {
          label: 'https://baidu.com',
          value: 'https://baidu.com',
        },
      ]}
    />
  );
};

const SelectGallery = () => (
  <Center flex="1" bg="background-default">
    <Stack direction="column" space="2" mb="2" alignItems="center" w="72">
      <Select1 />
      <Select
        footer={null}
        containerProps={{
          width: '280px',
          zIndex: 4,
        }}
        defaultValue="https://rpc.onekey.so/eth"
        options={[
          {
            label: 'https://rpc.onekey.so/eth',
            value: 'https://rpc.onekey.so/eth',
          },
          {
            label: 'https://google.com',
            value: 'https://google.com',
          },
          {
            label: 'https://baidu.com',
            value: 'https://baidu.com',
          },
        ]}
      />
      <Select
        title="Preset RPC URL"
        containerProps={{
          width: '280px',
          zIndex: 3,
        }}
        defaultValue="https://google.com"
        footer={null}
        options={[
          {
            label: 'https://rpc.onekey.so/eth',
            value: 'https://rpc.onekey.so/eth',
          },
          {
            label: 'https://google.com',
            value: 'https://google.com',
          },
          {
            label: 'https://baidu.com',
            value: 'https://baidu.com',
          },
        ]}
        renderItem={(option, isActive, onChange) => (
          <Pressable
            p="3"
            py="2"
            key={option.value}
            borderRadius="12px"
            display="flex"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            bg={isActive ? 'surface-selected' : 'transparent'}
            onPress={() => onChange?.(option.value, option)}
          >
            <Typography.Body1>{option.label}</Typography.Body1>
            {Math.random() < 0.5 ? (
              <Typography.Body1 color="text-success">111ms</Typography.Body1>
            ) : (
              <Spinner size="sm" />
            )}
          </Pressable>
        )}
      />
      <Select
        containerProps={{
          width: '280px',
          zIndex: 2,
        }}
        triggerProps={{
          width: '105px',
        }}
        footer={null}
        options={[
          {
            label: 'https://rpc.onekey.so/eth',
            value: 'https://rpc.onekey.so/eth',
          },
          {
            label: 'https://google.com',
            value: 'https://google.com',
          },
          {
            label: 'https://baidu.com',
            value: 'https://baidu.com',
          },
        ]}
      />
    </Stack>
  </Center>
);

export default SelectGallery;
