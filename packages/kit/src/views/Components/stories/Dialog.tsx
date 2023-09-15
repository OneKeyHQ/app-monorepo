import { Text } from 'react-native';

import { Button, Dialog } from '@onekeyhq/components';
import { confirm } from '@onekeyhq/components/src/Dialog';

import { Layout } from './utils/Layout';

const DialogGallery = () => (
  <Layout
    description="需要用户处理事务，又不希望跳转路由以致打断工作流程时，可以使用 Dialog 组件"
    suggestions={[
      'Dialog 的呈现层级高于页面，但低于 Toast',
      '需要避免在 Dialog 显示需要滚动操作的内容',
    ]}
    boundaryConditions={['禁止将 Dialog 作为路由页面使用']}
    elements={[
      {
        title: '唤起 Dialog',
        element: (
          <Button
            type="basic"
            onPress={() => {
              confirm({
                contentProps: {
                  title: 'title',
                },
                content: (
                  <Text>
           iod         orem Ipsum is simply dummy text of the printing and
                    typesetting industry.
                  </Text>
                ),
                footerButtonProps: {
                  onPrimaryActionPress: ({ onClose }) => {
                    console.log('点击 弹窗1 的主按钮');
                    onClose?.();
                  },
                  onSecondaryActionPress: () => {
                    console.log('点击 弹窗1 的副按钮');
                  },
                  primaryActionProps: {
                    type: 'outline',
                  },
                },
              });
            }}
          >
            open dialog
          </Button>
        ),
      },
    ]}
  />
);

export default DialogGallery;
