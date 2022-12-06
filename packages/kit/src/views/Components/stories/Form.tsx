import {
  Button,
  Center,
  Form,
  Icon,
  KeyboardAwareScrollView,
  KeyboardDismissView,
  Pressable,
  Spinner,
  Stack,
  Typography,
  useForm,
  useUserDevice,
} from '@onekeyhq/components';

type FormValues = {
  username: string;
  email: string;
  password: string;
  description: string;
  address: string;
  url: string;
  agreement: boolean;
  isDev: boolean;
  options: string;
};

type Option = { label: string; value: string; speed?: string };

const FormGallery = () => {
  const { size } = useUserDevice();
  const formWith = size === 'SMALL' ? 'full' : '320';
  const { control, handleSubmit, setError } = useForm<FormValues>();
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
  const labelAddon = (
    <Stack direction="row" space="2">
      <Pressable onPress={() => setError('email', { message: 'custom error' })}>
        <Icon size={16} name="ClipboardOutline" />
      </Pressable>
      <Pressable>
        <Icon size={16} name="BookOpenOutline" />
      </Pressable>
      <Pressable>
        <Icon size={16} name="BarsShrinkMini" />
      </Pressable>
    </Stack>
  );
  return (
    <KeyboardDismissView>
      <Center flex="1" background="background-hovered" p="2">
        <KeyboardAwareScrollView w="full">
          <Form width={formWith}>
            <Form.Item
              label="Username"
              labelAddon={labelAddon}
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
              label="Password"
              control={control}
              name="password"
              defaultValue=""
              rules={{
                required: 'Password cannot be empty',
                maxLength: { value: 10, message: 'The maximum length is 10.' },
              }}
            >
              <Form.PasswordInput placeholder="password" />
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
              label="Description"
              control={control}
              name="description"
              rules={{ required: 'description cannot be empty' }}
              defaultValue=""
            >
              <Form.Textarea placeholder="textarea" />
            </Form.Item>
            <Form.Item
              label="Address"
              control={control}
              name="address"
              rules={{ required: 'address cannot be empty' }}
              defaultValue=""
            >
              <Form.Textarea placeholder="textarea" />
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
            <Button mt="2" onPress={onSubmit}>
              Submit
            </Button>
          </Form>
        </KeyboardAwareScrollView>
      </Center>
    </KeyboardDismissView>
  );
};

export default FormGallery;
