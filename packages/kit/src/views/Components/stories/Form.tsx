import { Input, Label, Switch } from 'tamagui';

import { Button, Form, useForm } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const Form1 = () => {
  const form = useForm({
    defaultValues: {
      name: 'Nate Wienert',
    },
  });
  return (
    <Form
      form={form}
      footer={
        <Button
          buttonVariant="primary"
          onPress={() => {
            alert(JSON.stringify(form.getValues()));
          }}
        >
          <Button.Text>Submit</Button.Text>
        </Button>
      }
    >
      <Form.Field label="Name" name="name" control={form.control}>
        <Input flex={1} />
      </Form.Field>
      <Form.Field label="Notify" name="notify" control={form.control}>
        <Switch id="notify">
          <Switch.Thumb animation="quick" />
        </Switch>
      </Form.Field>
    </Form>
  );
};

const FormGallery = () => (
  <Layout
    description="通过表单完成内容提交"
    suggestions={[
      '通过表单组件控制输入内容，尽可能避免直接操作输入组件',
      '表单组件集成了键盘操作事件，对输入更为友好',
    ]}
    boundaryConditions={['禁止将 Dialog 作为路由页面使用']}
    elements={[
      {
        title: 'Simple Input Form',
        element: <Form1 />,
      },
    ]}
  />
);

export default FormGallery;
