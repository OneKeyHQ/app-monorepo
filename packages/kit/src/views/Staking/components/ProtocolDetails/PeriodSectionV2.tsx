import {
  Divider,
  EStepItemStatus,
  SizableText,
  Stack,
  Stepper,
  YStack,
} from '@onekeyhq/components';
import type { IStepItemProps } from '@onekeyhq/components';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

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
      renderTitle={({ status }) => {
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

export function PeriodSection({
  timeline,
}: {
  timeline?: IStakeEarnDetail['timeline'];
}) {
  if (!timeline) {
    return null;
  }
  return (
    <>
      <YStack gap="$6">
        <SizableText
          size={timeline.title.size || '$headingLg'}
          color={timeline.title.color}
        >
          {timeline.title.text}
        </SizableText>
        <YStack>
          <Stepper stepIndex={timeline.step}>
            {timeline.items.map((i) => (
              <CustomStepperItem
                key={i.title.text}
                title={i.title.text}
                description={i.description.text}
              />
            ))}
          </Stepper>
        </YStack>
      </YStack>
      <Divider />
    </>
  );
}
