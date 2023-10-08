import { useLayoutEffect } from 'react';

import { Button } from '@onekeyhq/components';
import type { ModalNavigationProp } from '@onekeyhq/components/src/Navigation';
import HeaderButtonIcon from '@onekeyhq/components/src/Navigation/Header/HeaderButtonIcon';
import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';

import { Layout } from '../../utils/Layout';
import useDemoAppNavigation from '../useDemoAppNavigation';

import { DemoDoneModalRoutes, RootModalRoutes } from './Routes';

import type { DemoDoneModalParamList } from './Routes';

const DemoDoneViewModal = () => {
  const navigation = useDemoAppNavigation();

  return (
    <Layout
      description="这是 DemoDoneViewModal"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[
        'BackButton 已经处理好了相关内容，所以不支持自定义 headerLeft 组件',
      ]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoDoneModal, {
                  screen: DemoDoneModalRoutes.DemoDone1Modal,
                });
              }}
            >
              <Button.Text>下一个例子</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

const DemoDone1ViewModal = () => {
  const navigation =
    useDemoAppNavigation<ModalNavigationProp<DemoDoneModalParamList>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButtonIcon name="AnonymousHidden2Outline" />,
    });
  }, [navigation]);

  return (
    <Layout
      description="这是 DemoDone1 ViewModal"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[
        'BackButton 已经处理好了相关内容，所以不支持自定义 headerLeft 组件',
      ]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoDoneModal, {
                  screen: DemoDoneModalRoutes.DemoDoneModal,
                });
              }}
            >
              <Button.Text>下一个例子</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

export const DoneModalStack: ModalFlowNavigatorConfig<
  DemoDoneModalRoutes,
  DemoDoneModalParamList
>[] = [
  {
    name: DemoDoneModalRoutes.DemoDoneModal,
    component: DemoDoneViewModal,
    translationId: 'Modal Done',
  },
  {
    name: DemoDoneModalRoutes.DemoDone1Modal,
    component: DemoDone1ViewModal,
    translationId: 'Modal Done 1',
  },
];
