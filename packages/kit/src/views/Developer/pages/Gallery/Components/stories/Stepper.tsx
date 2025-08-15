import {
  EStepItemStatus,
  SizableText,
  Stack,
  Stepper,
} from '@onekeyhq/components';
import type { IStepItemProps } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function CustomStepperItem({ title, description, ...props }: IStepItemProps) {
  return (
    <Stepper.Item
      {...props}
      containerStyle={{
        pb: '$3',
      }}
      textContainerStyle={{
        gap: '$1',
        $gtMd: {
          flexDirection: 'row',
        },
      }}
      renderTitle={() => {
        return (
          <SizableText size="$bodyMd" color="$textSubdued">
            {title}
          </SizableText>
        );
      }}
      renderDescription={({ status }) => {
        return (
          <SizableText
            size="$bodyMdMedium"
            color={status === EStepItemStatus.Done ? '$textSubdued' : undefined}
          >
            {description}
          </SizableText>
        );
      }}
      renderProgressBar={
        <Stack
          flex={1}
          position="absolute"
          left={9}
          bg="$iconDisabled"
          top={26}
          bottom={0}
          w="$0.5"
          h="$6"
          borderTopLeftRadius="$2"
          borderTopRightRadius="$2"
          borderBottomLeftRadius="$2"
          borderBottomRightRadius="$2"
          borderCurve="continuous"
          $gtMd={{
            h: '$3',
            top: 20,
          }}
        />
      }
      renderStatusIndicator={() => {
        return (
          <Stack
            w="$2"
            h="$2"
            m="$1.5"
            borderRadius="$full"
            bg="$iconDisabled"
          />
        );
      }}
    />
  );
}

function CustomStepper() {
  return (
    <Stepper stepIndex={1}>
      <CustomStepperItem
        title="Register and deposit your USDf:"
        description="Before 2025-04-28 00:00"
      />
      <CustomStepperItem
        title="Base yield distribution:"
        description="Real-time update"
      />
      <CustomStepperItem
        title="Falcon token airdrop distribution:"
        description="TGE time (announced by Falcon)"
      />
      <CustomStepperItem
        title="Guaranteed yield period:"
        description="TGE time (announced by Falcon)"
      />
    </Stepper>
  );
}

export default function StepperGallery() {
  return (
    <Layout
      filePath={__CURRENT_FILE_PATH__}
      componentName="Stepper"
      description="The Stepper component is used to display progress through a sequence of logical and numbered steps. It helps users understand where they are in a multi-step process and provides visual feedback on completed, current, and upcoming steps."
      suggestions={[
        'Guide users to complete tasks following a process',
        'Display current step and status',
        'Use for multi-step forms or workflows',
        'Provide clear visual indication of progress',
      ]}
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
        {
          title: 'Custom',
          element: <CustomStepper />,
        },
      ]}
    />
  );
}
