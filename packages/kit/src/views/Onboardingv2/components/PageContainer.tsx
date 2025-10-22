import type { IYStackProps } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';

export function PageContainer({ children, ...rest }: IYStackProps) {
  return (
    <YStack
      animation="quick"
      animateOnly={['opacity', 'transform']}
      enterStyle={{
        opacity: 0,
        x: 24,
      }}
      w="100%"
      maxWidth={400}
      alignSelf="center"
      py="$10"
      gap="$5"
      {...rest}
    >
      {children}
    </YStack>
  );
}
