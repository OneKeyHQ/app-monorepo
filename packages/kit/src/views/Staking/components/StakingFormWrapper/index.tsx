import { type IYStackProps, YStack } from '@onekeyhq/components';

export default function StakingFormWrapper({
  children,
  ...rest
}: IYStackProps) {
  return (
    <YStack p="$5" gap="$5" {...rest}>
      {children}
    </YStack>
  );
}
