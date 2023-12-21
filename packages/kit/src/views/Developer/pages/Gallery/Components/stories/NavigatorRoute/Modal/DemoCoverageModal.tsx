/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import {
  ActionList,
  Button,
  Dialog,
  Popover,
  Stack,
  Text,
  Toast,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator/ModalFlowNavigator';

import { Layout } from '../../utils/Layout';
import { NavigationFocusTools } from '../../utils/NavigationTools';
import { FreezeProbe } from '../../utils/RenderTools';
import useDemoAppNavigation from '../useDemoAppNavigation';

import { EDemoCoverageModalRoutes, ERootModalRoutes } from './Routes';

import type { IDemoCoverageModalParamList } from './Routes';

function DemoCoverageModal() {
  const navigation =
    useDemoAppNavigation<IModalNavigationProp<IDemoCoverageModalParamList>>();

  return (
    <Layout
      description="这是一个测试 Modal 覆盖的演示"
      suggestions={[
        '测试 Toast 覆盖',
        '测试 Modal 覆盖 Modal',
        '测试 Dialog 覆盖 Modal',
      ]}
      boundaryConditions={[]}
      elements={[
        {
          title: '开始 Demo',
          element: (
            <Button
              onPress={() => {
                navigation.pushModal(ERootModalRoutes.DemoCoverageModal, {
                  screen: EDemoCoverageModalRoutes.DemoCoverageDialogModal,
                });
              }}
            >
              开始 Demo
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoCoverageModal" />
              <NavigationFocusTools componentName="DemoCoverageModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
}

const ControlledPopoverByButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover
      title="Popover Demo"
      open={isOpen}
      onOpenChange={setIsOpen}
      renderTrigger={<Button onPress={() => setIsOpen(true)}>Open</Button>}
      renderContent={
        <Stack space="$4" p="$5">
          <Text>
            Non exercitation ea laborum cupidatat sunt amet aute exercitation
            occaecat minim incididunt non est est voluptate.
          </Text>
          <Button variant="primary" onPress={() => setIsOpen(false)}>
            Button
          </Button>
        </Stack>
      }
    />
  );
};

const ControlledActionListByButton = () => (
  <ActionList
    title="Action List"
    renderTrigger={<Button>Action List</Button>}
    items={[
      {
        label: 'Action1',
        icon: 'PlaceholderOutline',
        onPress: () => {
          console.log('action1');
        },
      },
      {
        label: 'Action2',
        icon: 'PlaceholderOutline',
        onPress: () => {
          console.log('action2');
        },
      },
      {
        label: 'Action3',
        icon: 'PlaceholderOutline',
        onPress: () => {
          console.log('action2');
        },
        disabled: true,
      },
    ]}
  />
);

function DemoCoverageDialogModal() {
  const navigation =
    useDemoAppNavigation<IModalNavigationProp<IDemoCoverageModalParamList>>();

  return (
    <Layout
      description="这是一个测试 Dialog 覆盖 Modal 的测试"
      suggestions={[]}
      boundaryConditions={[]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(ERootModalRoutes.DemoCoverageModal, {
                  screen: EDemoCoverageModalRoutes.DemoCoverageModalModal,
                });
              }}
            >
              下一个例子
            </Button>
          ),
        },
        {
          title: '测试 Toast 覆盖',
          element: (
            <Button
              onPress={() => {
                const toastMessage = (i = 0) => {
                  Toast.message({
                    title: `我覆盖在 Modal 上面: ${i}`,
                  });
                  if (i < 10) {
                    setTimeout(() => {
                      toastMessage(i + 1);
                    }, 1000);
                  }
                };
                toastMessage();
              }}
            >
              弹出 Toast
            </Button>
          ),
        },
        {
          title: 'Open Popover by Button',
          element: <ControlledPopoverByButton />,
        },
        {
          title: 'Open ActionList by Button',
          element: <ControlledActionListByButton />,
        },
        {
          title: 'Open Modal by Api',
          element: (
            <Button
              onPress={() =>
                Dialog.show({
                  title: '我站在 Modal 上面',
                  description:
                    '通过 Api 打开的, 点击确定按钮会关闭 Dialog 打开一个 Modal',
                  onConfirm() {
                    navigation.pushModal(ERootModalRoutes.DemoLockedModal);
                  },
                })
              }
            >
              Open Dialog
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoCoverageDialogModal" />
              <NavigationFocusTools componentName="DemoCoverageDialogModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
}

function DemoCoverageModalModal() {
  const navigation =
    useDemoAppNavigation<IModalNavigationProp<IDemoCoverageModalParamList>>();

  return (
    <Layout
      description="这是一个测试 Modal 覆盖的演示"
      suggestions={[
        '直接通过 navigation.pushModal(ERootModalRoutes.DemoLockedModal) 跳转即可',
      ]}
      boundaryConditions={[]}
      elements={[
        {
          title: '跳转到其他 Stack 的 Modal',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(ERootModalRoutes.DemoLockedModal);
              }}
            >
              跳转
            </Button>
          ),
        },
        {
          title: '关闭',
          element: (
            <Button
              onPress={() => {
                navigation.popStack();
                Toast.message({
                  title: 'Close Modal',
                });
              }}
            >
              关闭并弹出 Toast
            </Button>
          ),
        },
        {
          title: '关闭',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                Toast.message({
                  title: 'Close Modal',
                });
                navigation.popStack();
              }}
            >
              弹出 Toast 然后关闭
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoCoverageModalModal" />
              <NavigationFocusTools componentName="DemoCoverageModalModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
}

export const CoverageModalStack: IModalFlowNavigatorConfig<
  EDemoCoverageModalRoutes,
  IDemoCoverageModalParamList
>[] = [
  {
    name: EDemoCoverageModalRoutes.DemoCoverageModal,
    component: DemoCoverageModal,
    translationId: 'Coverage Modal Demo',
  },
  {
    name: EDemoCoverageModalRoutes.DemoCoverageDialogModal,
    component: DemoCoverageDialogModal,
    translationId: 'Coverage Dialog Modal',
  },
  {
    name: EDemoCoverageModalRoutes.DemoCoverageModalModal,
    component: DemoCoverageModalModal,
    translationId: 'Coverage Modal Modal',
  },
];
