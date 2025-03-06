import { Stepper } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

export default function StepperGallery() {
  return (
    <Layout
      componentName="Spotlight"
      description="Spotlight 组件"
      suggestions={[
        '如果需要重复测试需用 backgroundApiProxy.serviceSpotlight.reset(); 重置',
        '需要定义唯一 ESpotlightTour 值',
      ]}
      elements={[
        {
          title: 'Default',
          element: <Stepper>
                      <Stepper.item>
                        
                      </Stepper.item>
                    </Stepper>,
        },
      ]}
    />
  );
}
