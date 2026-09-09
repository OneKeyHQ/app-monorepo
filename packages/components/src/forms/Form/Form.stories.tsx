import { useCallback } from 'react';

import { fn } from 'storybook/test';

import { Form } from '@onekeyhq/components/src/forms/Form';
import { Input } from '@onekeyhq/components/src/forms/Input';
import { Switch } from '@onekeyhq/components/src/forms/Switch';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

type IDemoFormValues = {
  name: string;
  passphrase: string;
  backup: boolean;
};

const EMPTY_VALUES: IDemoFormValues = {
  name: '',
  passphrase: '',
  backup: true,
};

const PREFILLED_VALUES: IDemoFormValues = {
  name: 'Main wallet',
  passphrase: '',
  backup: false,
};

const NAME_RULES = {
  required: 'Wallet name is required.',
  maxLength: { value: 24, message: 'Keep it under 24 characters.' },
} as const;

// Form wires react-hook-form through context: useForm() creates the instance,
// Form.Field wraps a Controller and clones its child with value/onChange and
// the field error injected. Validation runs on blur by default; form.submit()
// (added by the useForm wrapper) validates, then calls useForm's onSubmit.
function FormDemo({
  onSubmit,
  initialValues = EMPTY_VALUES,
}: {
  onSubmit: (values: IDemoFormValues) => void;
  initialValues?: IDemoFormValues;
}) {
  const form = useForm<IDemoFormValues>({
    defaultValues: initialValues,
    onSubmit: (instance) => onSubmit(instance.getValues()),
  });

  const handleSave = useCallback(() => {
    void form.submit?.();
  }, [form]);

  return (
    <YStack maxWidth={360} gap="$5">
      <Form form={form}>
        <Form.Field
          name="name"
          label="Wallet name"
          rules={NAME_RULES}
          description="Shown in the wallet list."
        >
          <Input placeholder="e.g. Main wallet" />
        </Form.Field>
        <Form.Field name="passphrase" label="Passphrase" optional>
          <Input placeholder="Up to 50 characters" secureTextEntry />
        </Form.Field>
        <Form.Field
          name="backup"
          label="Cloud backup"
          horizontal
          description="Encrypted before upload."
        >
          <Switch />
        </Form.Field>
      </Form>
      <Button variant="primary" onPress={handleSave}>
        Save
      </Button>
    </YStack>
  );
}

const meta = {
  title: 'Forms/Form',
  component: FormDemo,
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof FormDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// Press Save with an empty name (or blur the field) to see the validation
// message animate in; fill it in to see onSubmit in the Actions panel.
export const Playground: Story = {};

export const Prefilled: Story = {
  args: {
    initialValues: PREFILLED_VALUES,
  },
};
