import { useNavigation } from '@react-navigation/native';

import type { IXStackProps, IYStackProps } from '@onekeyhq/components';
import {
  Button,
  IconButton,
  LinearGradient,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

const OnboardingLayoutBack = () => {
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();

  const canGoBack = reactNavigation.canGoBack();
  const icon = canGoBack ? 'ArrowLeftOutline' : 'CrossedLargeOutline';

  const handleBack = () => {
    navigation.pop();
  };

  return (
    <IconButton
      size="small"
      icon={icon}
      variant="tertiary"
      onPress={handleBack}
    />
  );
};

const OnboardingLayoutLanguageSelector = () => (
  <Button size="small" icon="GlobusOutline" variant="tertiary" ml="auto">
    English
  </Button>
);

const OnboardingLayoutTitle = ({ children }: { children: React.ReactNode }) => (
  <SizableText
    size="$headingLg"
    textAlign="center"
    position="absolute"
    left="50%"
    style={{ transform: [{ translateX: '-50%' }] }}
  >
    {children}
  </SizableText>
);

const OnboardingLayoutHeader = ({
  showBackButton = true,
  showLanguageSelector = true,
  title,
  children,
  ...rest
}: {
  showBackButton?: boolean;
  showLanguageSelector?: boolean;
  title?: string;
  children?: React.ReactNode;
} & IXStackProps) => (
  <XStack
    h="$6"
    px={56}
    borderWidth={0}
    borderTopWidth={1}
    borderBottomWidth={1}
    borderStyle="dashed"
    borderColor="$neutral4"
    alignItems="center"
    {...rest}
  >
    {showBackButton ? <OnboardingLayoutBack /> : null}
    {title ? <OnboardingLayoutTitle>{title}</OnboardingLayoutTitle> : null}
    {showLanguageSelector ? <OnboardingLayoutLanguageSelector /> : null}
    {children}
  </XStack>
);

function OnboardingLayoutConstrainedContent({
  children,
  ...rest
}: { children: React.ReactNode } & IYStackProps) {
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

const OnboardingLayoutBody = ({
  children,
  scrollable = true,
  constrained = true,
  ...rest
}: {
  children: React.ReactNode;
  scrollable?: boolean;
  constrained?: boolean;
} & IYStackProps) => {
  const content = constrained ? (
    <OnboardingLayoutConstrainedContent>
      {children}
    </OnboardingLayoutConstrainedContent>
  ) : (
    children
  );

  return (
    <YStack
      px="$10"
      flex={1}
      borderWidth={0}
      borderTopWidth={1}
      borderBottomWidth={1}
      borderStyle="dashed"
      borderColor="$neutral4"
      overflow="hidden"
      {...rest}
    >
      {scrollable ? <ScrollView>{content}</ScrollView> : content}
      {scrollable ? (
        <LinearGradient
          position="absolute"
          left={41}
          right={41}
          bottom={0}
          h="$10"
          colors={['$transparent', '$bgApp']}
        />
      ) : null}
    </YStack>
  );
};

function OnboardingLayoutFooter({ children }: { children?: React.ReactNode }) {
  return (
    <YStack
      h="$6"
      borderWidth={0}
      borderTopWidth={1}
      borderBottomWidth={1}
      borderStyle="dashed"
      borderColor="$neutral4"
      justifyContent="center"
      alignItems="center"
    >
      {children}
    </YStack>
  );
}

const OnboardingLayoutRoot = ({ children }: { children: React.ReactNode }) => (
  <YStack
    h="100%"
    alignItems="center"
    justifyContent="center"
    bg="$neutral2"
    $gt2xl={{
      p: '$10',
      pb: '$20',
    }}
  >
    <YStack
      h="100%"
      w="100%"
      maxWidth={1600}
      maxHeight={1024}
      px="$10"
      bg="$bg"
      $gt2xl={{
        borderRadius: 40,
        borderCurve: 'continuous',
        '$platform-web': {
          boxShadow:
            '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        },
      }}
    >
      <YStack
        py="$10"
        h="100%"
        borderWidth={0}
        borderLeftWidth={1}
        borderRightWidth={1}
        borderStyle="dashed"
        borderColor="$neutral4"
      >
        <YStack h="100%" gap="$10" mx="$-10">
          {children}
        </YStack>
      </YStack>
    </YStack>
  </YStack>
);

export const OnboardingLayout = Object.assign(OnboardingLayoutRoot, {
  Header: OnboardingLayoutHeader,
  Body: OnboardingLayoutBody,
  ConstrainedContent: OnboardingLayoutConstrainedContent,
  Footer: OnboardingLayoutFooter,
  Language: OnboardingLayoutLanguageSelector,
  Back: OnboardingLayoutBack,
  Title: OnboardingLayoutTitle,
});
