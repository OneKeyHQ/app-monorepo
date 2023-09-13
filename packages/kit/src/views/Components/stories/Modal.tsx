import { useState } from 'react';

import {
  Box,
  Button,
  Center,
  Modal,
  Stack,
  Typography,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

import type { ViewStyle } from 'react-native';

const style = {
  position: 'relative',
} as ViewStyle;

function ModalGallery() {
  return (
    <Layout
      description="模态框"
      suggestions={[
        '与传统组件库中的 Modal 不同，Modal 主要用与 Modal 类路由页面',
        'Modal 本身并不具备浮层效果',
        '在 App 中，Modal 会覆盖在当前页面之上，并改变当前页面的路由',
        '在 Web 中 Modal 会呈现为弹窗样式，并改变当前页面的路由',
      ]}
      boundaryConditions={[
        '禁止使用 showOverlay 呈现 Modal 组件。如有需求，请使用 Dialog',
        'Modal 在 Web 端不支持',
      ]}
      elements={[
        {
          title: '默认样式',
          element: (
            <Box position="relative">
              <Modal containerStyle={style}>
                <Typography.Body2>
                  orem Ipsum is simply dummy text of the printing and
                  typesetting industry. Lorem Ipsum has been the industry's
                  standard dummy text ever since the 1500s, when an unknown
                  printer took a galley of type and scrambled it to make a type
                  specimen book. It has survived not only five centuries, but
                  also the leap into electronic typesetting, remaining
                  essentially unchanged. It was popularised in the 1960s with
                  the release of Letraset sheets containing Lorem Ipsum
                  passages, and more recently with desktop publishing software
                  like Aldus PageMaker including versions of Lorem Ipsum.
                </Typography.Body2>
              </Modal>
            </Box>
          ),
        },
        {
          title: '隐藏头部',
          element: (
            <Box position="relative">
              <Modal containerStyle={style} headerShown={false}>
                <Typography.Body2>No Header</Typography.Body2>
              </Modal>
            </Box>
          ),
        },
        {
          title: '隐藏返回按钮',
          element: (
            <Box position="relative">
              <Modal containerStyle={style} hideBackButton>
                <Typography.Body2>No BackButton</Typography.Body2>
              </Modal>
            </Box>
          ),
        },
        {
          title: '自定义 Footer',
          element: (
            <Box position="relative">
              <Modal
                containerStyle={style}
                footer={
                  <Center height={24}>
                    <Typography.Body2>自定义 footer</Typography.Body2>
                  </Center>
                }
              >
                <Typography.Body2>
                  orem Ipsum is simply dummy text of the printing and
                  typesetting industry.
                </Typography.Body2>
              </Modal>
            </Box>
          ),
        },
        {
          title: '隐藏底部按钮',
          element: (
            <Stack space={2}>
              <Box position="relative">
                <Modal
                  containerStyle={style}
                  hidePrimaryAction
                  secondaryActionProps={{
                    onPress: () => {
                      alert('the secondary action one clicked');
                    },
                  }}
                >
                  <Typography.Body2>
                    Give the visible button a try and see.
                  </Typography.Body2>
                </Modal>
              </Box>
              <Box position="relative">
                <Modal
                  containerStyle={style}
                  hideSecondaryAction
                  primaryActionProps={{
                    onPress: () => {
                      alert('the primary action one clicked');
                    },
                  }}
                >
                  <Typography.Body2>
                    Give the visible button a try and see.
                  </Typography.Body2>
                </Modal>
              </Box>
            </Stack>
          ),
        },
        {
          title: '滚动视图按钮（TODO）',
          element: (
            <Stack space={2}>
              <Box position="relative">
                <Modal containerStyle={style}>
                  <Typography.Body2>FlatList View</Typography.Body2>
                </Modal>
              </Box>
              <Box position="relative">
                <Modal containerStyle={style}>
                  <Typography.Body2>SectionList View</Typography.Body2>
                </Modal>
              </Box>
              <Box position="relative">
                <Modal containerStyle={style}>
                  <Typography.Body2>ScrollView View</Typography.Body2>
                </Modal>
              </Box>
            </Stack>
          ),
        },
      ]}
    />
  );
}

export default ModalGallery;
