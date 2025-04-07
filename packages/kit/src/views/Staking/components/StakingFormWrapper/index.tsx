import { type IYStackProps, YStack } from '@onekeyhq/components';

export default function StakingFormWrapper({
  children,
  ...rest
}: IYStackProps) {
  return (
    <YStack px="$5" py="$2.5" gap="$2.5" {...rest}>
      {children}
    </YStack>
  );
}
