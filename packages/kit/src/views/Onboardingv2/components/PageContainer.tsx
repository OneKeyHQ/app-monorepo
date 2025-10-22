import type { IYStackProps } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

export function PageContainerFooter({ children, ...rest }: IYStackProps) {
  return (
    <YStack
      position={platformEnv.isNative ? 'absolute' : ('fixed' as any)}
      bottom={0}
      left={0}
      right={0}
      {...rest}
    >
      {children}
    </YStack>
  );
}
