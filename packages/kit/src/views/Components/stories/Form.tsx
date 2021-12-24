import React from 'react';

import {
  Button,
  Center,
  Form,
  Pressable,
  Spinner,
  Typography,
  useForm,
} from '@onekeyhq/components';

type FormValues = {
  username: string;
  email: string;
  description: string;
  url: string;
  agreement: boolean;
  isDev: boolean;
  options: string;
};

type Option = { label: string; value: string; speed?: string };

const FormGallery = () => {
  const { control, handleSubmit } = useForm<FormValues>();
  const onSubmit = handleSubmit((data) => console.log(data));
  const options: Option[] = [
    {
      label: 'https://google.com',
      value: 'https://google.com',
    },
    {
      label: 'https://rpc.onekey.so/eth',
      value: 'https://rpc.onekey.so/eth',
    },
    {
      label: 'https://baidu.com',
      value: 'https://baidu.com',
    },
  ];
  return (
    <Center flex="1" background="background-hovered">
      <Form>
        <Form.Item
          label="Username"
          control={control}
          name="username"
          defaultValue=""
          rules={{
            required: 'Username cannot be empty',
            maxLength: { value: 10, message: 'The maximum length is 10.' },
          }}
        >
          <Form.Input placeholder="placeholder" />
        </Form.Item>
        <Form.Item
          label="Email"
          control={control}
          name="email"
          rules={{
            required: 'Email cannot be empty',
            pattern: {
              value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
              message: 'Email address format error',
            },
          }}
          defaultValue=""
        >
          <Form.Input placeholder="placeholder" />
        </Form.Item>
        <Form.Item
          label="Description"
          control={control}
          name="description"
          rules={{ required: 'description cannot be empty' }}
          defaultValue=""
        >
          <Form.Textarea placeholder="textarea" />
        </Form.Item>
        <Form.Item
          name="url"
          control={control}
          label="rpcUrl"
          defaultValue="https://rpc.onekey.so/eth"
          formControlProps={{ zIndex: 10 }}
        >
          <Form.Select
            containerProps={{
              zIndex: 999,
            }}
            triggerProps={{
              paddingTop: 2,
              paddingBottom: 2,
            }}
            title="Preset RPC URL"
            footer={null}
            options={options}
            renderItem={(option, isActive, onChange) => (
              <Pressable
                p="3"
                py="2"
                key={option.value as string}
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
                  <Typography.Body1 color="text-success">
                    111ms
                  </Typography.Body1>
                ) : (
                  <Spinner size="sm" />
                )}
              </Pressable>
            )}
          />
        </Form.Item>
        <Form.Item
          label=""
          control={control}
          name="agreement"
          rules={{ required: 'agreement cannot be empty' }}
          defaultValue={false}
        >
          <Form.CheckBox title="xxx xxx xxx" />
        </Form.Item>
        <Form.Item
          control={control}
          name="isDev"
          rules={{ required: 'isDev cannot be empty' }}
          defaultValue={false}
        >
          <Form.Switch labelType="after" label="is Dev Mode" />
        </Form.Item>
        <Form.Item
          label="options"
          control={control}
          name="options"
          defaultValue="A"
        >
          <Form.RadioGroup name="options">
            <Form.Radio value="A" title="A" />
            <Form.Radio value="B" title="B" />
            <Form.Radio value="C" title="C" />
          </Form.RadioGroup>
        </Form.Item>
        <Button mt="2" onPress={onSubmit}>
          Submit
        </Button>
      </Form>
    </Center>
  );
};

export default FormGallery;
