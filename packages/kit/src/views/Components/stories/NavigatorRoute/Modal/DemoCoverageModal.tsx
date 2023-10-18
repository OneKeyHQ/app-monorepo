/* eslint-disable react/no-unstable-nested-components */
import { useMemo, useState } from 'react';

import { Dialog, NewButton, Stack, Toast } from '@onekeyhq/components';
import type { ModalNavigationProp } from '@onekeyhq/components/src/Navigation';
import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator/ModalFlowNavigator';

import { Layout } from '../../utils/Layout';
import { NavigationFocusTools } from '../../utils/NavigationTools';
import { FreezeProbe } from '../../utils/RenderTools';
import useDemoAppNavigation from '../useDemoAppNavigation';

import { DemoCoverageModalRoutes, RootModalRoutes } from './Routes';

import type { DemoCoverageModalParamList } from './Routes';

function DemoCoverageModal() {
  const navigation =
    useDemoAppNavigation<ModalNavigationProp<DemoCoverageModalParamList>>();

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
            <NewButton
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoCoverageModal, {
                  screen: DemoCoverageModalRoutes.DemoCoverageDialogModal,
                });
              }}
            >
              开始 Demo
            </NewButton>
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

const ControlledDialogByButton = () => {
  const navigation =
    useDemoAppNavigation<ModalNavigationProp<DemoCoverageModalParamList>>();

  const [isOpen, changeIsOpen] = useState(false);
  return useMemo(
    () => (
      <>
        <NewButton onPress={() => changeIsOpen(true)}>
          Open Modal By Button
        </NewButton>
        <Dialog
          backdrop
          title="我站在 Modal 上面"
          description="通过组件挂载的 Dialog，点击确定按钮关闭 Dialog 打开一个 Modal"
          open={isOpen}
          onClose={() => {
            changeIsOpen(false);
          }}
          onConfirm={() => {
            navigation.pushModal(RootModalRoutes.DemoLockedModal);
            changeIsOpen(false);
          }}
        />
      </>
    ),
    [],
  );
};

function DemoCoverageDialogModal() {
  const navigation =
    useDemoAppNavigation<ModalNavigationProp<DemoCoverageModalParamList>>();

  return (
    <Layout
      description="这是一个测试 Dialog 覆盖 Modal 的测试"
      suggestions={[]}
      boundaryConditions={[]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <NewButton
              variant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoCoverageModal, {
                  screen: DemoCoverageModalRoutes.DemoCoverageModalModal,
                });
              }}
            >
              下一个例子
            </NewButton>
          ),
        },
        {
          title: '测试 Toast 覆盖',
          element: (
            <NewButton
              onPress={() => {
                Toast.message({
                  title: '我覆盖在 Modal 上面',
                });
              }}
            >
              弹出 Toast
            </NewButton>
          ),
        },
        // {
        //   title: 'Open Modal by Button',
        //   element: <ControlledDialogByButton />,
        // },
        {
          title: 'Open Modal by Api',
          element: (
            <NewButton
              onPress={() =>
                Dialog.confirm({
                  title: '我站在 Modal 上面',
                  description:
                    '通过 Api 打开的, 点击确定按钮会关闭 Dialog 打开一个 Modal',
                  onConfirm() {
                    navigation.pushModal(RootModalRoutes.DemoLockedModal);
                    return Promise.resolve(true);
                  },
                })
              }
            >
              Open Dialog
            </NewButton>
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
    useDemoAppNavigation<ModalNavigationProp<DemoCoverageModalParamList>>();

  return (
    <Layout
      description="这是一个测试 Modal 覆盖的演示"
      suggestions={[
        '直接通过 navigation.pushModal(RootModalRoutes.DemoLockedModal) 跳转即可',
      ]}
      boundaryConditions={[]}
      elements={[
        {
          title: '跳转到其他 Stack 的 Modal',
          element: (
            <NewButton
              variant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoLockedModal);
              }}
            >
              跳转
            </NewButton>
          ),
        },
        {
          title: '关闭',
          element: (
            <NewButton
              onPress={() => {
                navigation.popStack();
                Toast.message({
                  title: 'Close Modal',
                });
              }}
            >
              关闭并弹出 Toast
            </NewButton>
          ),
        },
        {
          title: '关闭',
          element: (
            <NewButton
              variant="primary"
              onPress={() => {
                Toast.message({
                  title: 'Close Modal',
                });
                navigation.popStack();
              }}
            >
              弹出 Toast 然后关闭
            </NewButton>
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

export const CoverageModalStack: ModalFlowNavigatorConfig<
  DemoCoverageModalRoutes,
  DemoCoverageModalParamList
>[] = [
  {
    name: DemoCoverageModalRoutes.DemoCoverageModal,
    component: DemoCoverageModal,
    translationId: 'Coverage Modal Demo',
  },
  {
    name: DemoCoverageModalRoutes.DemoCoverageDialogModal,
    component: DemoCoverageDialogModal,
    translationId: 'Coverage Dialog Modal',
  },
  {
    name: DemoCoverageModalRoutes.DemoCoverageModalModal,
    component: DemoCoverageModalModal,
    translationId: 'Coverage Modal Modal',
  },
];
