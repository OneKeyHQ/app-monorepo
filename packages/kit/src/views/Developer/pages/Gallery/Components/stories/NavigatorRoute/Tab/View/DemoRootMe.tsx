import { SizableText, Stack } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';

const DemoRootMe = () => {
  return (
    <Layout
      description="这是一个 Tab 切换演示"
      suggestions={['需要使用 useDemoAppNavigation hook 的 switchTab 方法']}
      boundaryConditions={[]}
      elements={[
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoRootMe" />
              <NavigationFocusTools componentName="DemoRootMe" />
            </Stack>
          ),
        },
        {
          title: 'BottomTab 渲染卡顿测试',
          element: (
            <Stack>
              {new Array(1000).fill({}).map((_, index) => (
                <SizableText key={index}>
                  这是有1000个 View 的 BottomTab 卡顿测试{index}
                </SizableText>
              ))}
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default DemoRootMe;
