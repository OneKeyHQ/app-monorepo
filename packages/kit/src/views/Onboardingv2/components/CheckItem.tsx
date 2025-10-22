import type { IYStackProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Icon,
  SizableText,
  Spinner,
  XStack,
  YStack,
  withStaticProperties,
} from '@onekeyhq/components';

function CheckItemImage({
  children,
  state,
  ...rest
}: {
  state?: 'running' | 'success';
} & IYStackProps) {
  return (
    <YStack
      w="$16"
      h="$16"
      borderRadius="$2"
      bg="$bg"
      borderCurve="continuous"
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
      }}
      $theme-dark={{
        bg: '$whiteA1',
        borderWidth: 1,
        borderColor: '$neutral3',
      }}
      $platform-native={{
        borderWidth: 1,
        borderColor: '$neutral3',
      }}
      alignItems="center"
      justifyContent="center"
      {...rest}
    >
      {children}
      {state ? (
        <YStack
          position="absolute"
          right={-9}
          bottom={-9}
          w={26}
          h={26}
          borderWidth={1}
          bg="$bg"
          borderRadius="$full"
          borderColor="$borderSubdued"
          alignItems="center"
          justifyContent="center"
        >
          <AnimatePresence exitBeforeEnter initial={false}>
            {state === 'running' ? (
              <Spinner
                key="spinner"
                size="small"
                animation="quick"
                enterStyle={{ scale: 0.7, opacity: 0 }}
                exitStyle={{ scale: 0.7, opacity: 0 }}
                scale={0.8}
              />
            ) : null}
            {state === 'success' ? (
              <Icon
                animation="quick"
                enterStyle={{ scale: 0.8, opacity: 0 }}
                exitStyle={{ scale: 0.8, opacity: 0 }}
                key="checkmark"
                name="Checkmark2SmallOutline"
                color="$iconActive"
                size="$5"
              />
            ) : null}
          </AnimatePresence>
        </YStack>
      ) : null}
    </YStack>
  );
}

function CheckItemContent({ children }: { children: React.ReactNode }) {
  return (
    <YStack gap="$1" flex={1}>
      {children}
    </YStack>
  );
}

function CheckItemTitle({ children }: { children: React.ReactNode }) {
  return <SizableText size="$bodyMdMedium">{children}</SizableText>;
}

function CheckItemDescription({ children }: { children: React.ReactNode }) {
  return <SizableText color="$textSubdued">{children}</SizableText>;
}

function CheckItemRoot({
  children,
  running,
}: {
  children: React.ReactNode;
  running?: boolean;
}) {
  return (
    <XStack alignItems="center" gap="$5">
      <AnimatePresence>
        {running ? (
          <YStack
            animation="quick"
            animateOnly={['opacity', 'transform']}
            enterStyle={{
              opacity: 0,
              scale: 0.97,
            }}
            exitStyle={{
              opacity: 0,
              scale: 0.97,
            }}
            position="absolute"
            left={-16}
            top={-16}
            right={-16}
            bottom={-16}
            bg="$bgSubdued"
            borderRadius="$4"
            borderCurve="continuous"
            $platform-web={{
              boxShadow:
                '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            }}
            zIndex={0}
          />
        ) : null}
      </AnimatePresence>
      {children}
    </XStack>
  );
}

export const CheckItem = withStaticProperties(CheckItemRoot, {
  Image: CheckItemImage,
  Content: CheckItemContent,
  Title: CheckItemTitle,
  Description: CheckItemDescription,
});
