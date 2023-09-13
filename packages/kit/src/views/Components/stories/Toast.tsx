import { Row, Stack } from 'native-base';
import { useIntl } from 'react-intl';

import { Button, ToastManager } from '@onekeyhq/components';
import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';

import { Layout } from './utils/Layout';

const ToastGallery = () => {
  const intl = useIntl();
  return (
    <Layout
      description="对操作结果的反馈，无需用户操作即可自行消失"
      suggestions={[
        'Toast 显示的文本应少于 20 字',
        '使用 Toast 显示简约明确的信息反馈',
        '不建议使用 Toast 显示过长的报错信息',
      ]}
      boundaryConditions={[
        'Toast 永远拥有最高层级的浮层',
        'Toast 组件能显示的最长文本内容为三排，超出三排将会缩略',
        '界面中只会存在一个 Toast 示例，后触发的 Toast 信息会覆盖前一条 Toast 信息',
      ]}
    >
      <Stack space={6}>
        <Row>
          <Button
            type="primary"
            onPress={() => {
              ToastManager.show({
                title: 'Success',
              });
            }}
          >
            使用默认类型打开 Toast(默认类型为 ToastManagerType.success)
          </Button>
        </Row>
        <Row>
          <Button
            type="destructive"
            onPress={() => {
              ToastManager.show(
                {
                  title: 'Failed',
                },
                { type: ToastManagerType.error },
              );
            }}
          >
            使用 error 类型打开 Toast
          </Button>
        </Row>
        <Row>
          <Button
            type="basic"
            onPress={() => {
              ToastManager.show(
                {
                  title: 'Fetching...',
                },
                { type: ToastManagerType.default },
              );
            }}
          >
            使用 default 类型打开 Toast
          </Button>
        </Row>
        <Row>
          <Button
            type="basic"
            onPress={() => {
              ToastManager.show(
                {
                  title: `orem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`,
                },
                { type: ToastManagerType.default },
              );
            }}
          >
            超长文本
          </Button>
        </Row>
        <Row>
          <Button
            type="basic"
            onPress={() => {
              ToastManager.show(
                {
                  title: intl.formatMessage({
                    id: 'form__search',
                  }),
                },
                { type: ToastManagerType.default },
              );
            }}
          >
            i18n
          </Button>
        </Row>
      </Stack>
    </Layout>
  );
};

export default ToastGallery;
