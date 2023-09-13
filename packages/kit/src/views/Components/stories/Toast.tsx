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
      elements={[
        {
          title: '使用 Toast',
          description: 'Toast type 为空时，默认为 success',
          element: (
            <Button
              type="primary"
              onPress={() => {
                ToastManager.show({
                  title: 'Hello Toast.',
                });
              }}
            >
              use Toast
            </Button>
          ),
        },
        {
          title: 'success type',
          element: (
            <Button
              type="primary"
              onPress={() => {
                ToastManager.show(
                  {
                    title: 'Success',
                  },
                  { type: ToastManagerType.success },
                );
              }}
            >
              ToastManagerType.success
            </Button>
          ),
        },
        {
          title: 'error type',
          element: (
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
              ToastManagerType.error
            </Button>
          ),
        },
        {
          title: 'default Type',
          element: (
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
              ToastManagerType.default
            </Button>
          ),
        },
        {
          title: '超长文本',
          element: (
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
              Long Long Text
            </Button>
          ),
        },
        {
          title: 'i18n',
          element: (
            <Button
              type="basic"
              onPress={() => {
                ToastManager.show({
                  title: intl.formatMessage({
                    id: 'form__search',
                  }),
                });
              }}
            >
              form__search
            </Button>
          ),
        },
      ]}
    />
  );
};

export default ToastGallery;
