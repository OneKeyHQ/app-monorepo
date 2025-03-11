import { Stepper } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

export default function StepperGallery() {
  return (
    <Layout
      componentName="Stepper"
      description="Stepper 步骤组件"
      suggestions={['用于引导用户按照流程完成任务', '展示当前步骤和状态']}
      elements={[
        {
          title: 'Default',
          element: (
            <Stepper stepIndex={2} hasError={false}>
              <Stepper.Item
                title="Step 1"
                description="Description for step 1"
              />
              <Stepper.Item
                title="Step 2"
                description="Description for step 2"
              />
              <Stepper.Item
                title="Step 3"
                description="Description for step 3"
                badgeText="50%"
              />
            </Stepper>
          ),
        },
      ]}
    />
  );
}
