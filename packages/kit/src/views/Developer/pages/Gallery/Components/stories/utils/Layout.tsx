import type { ComponentType, ReactElement } from 'react';

import { StackActions } from '@react-navigation/native';

import {
  Button,
  IconButton,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useKeyboardHeight } from '@onekeyhq/components/src/hooks';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ERootRoutes,
  ETabDeveloperRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

const FormattedText = ({ text }: { text: string | string[] }) => {
  if (typeof text === 'string') {
    return (
      <Stack>
        <SizableText>{text}。 </SizableText>
      </Stack>
    );
  }
  if (Array.isArray(text) && text.length === 0) {
    return null;
  }
  return (
    <Stack>
      <Stack gap="$1">
        {text.map((item, index) => (
          <Stack key={index.toString()}>
            <SizableText>
              {index + 1}. {item}
              {index === text.length - 1 ? '。' : '；'}
            </SizableText>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};

export function Layout({
  description = '',
  suggestions = [],
  boundaryConditions = [],
  elements = [],
  scrollEnabled = true,
  contentInsetAdjustmentBehavior = 'never',
  skipLoading = false,
  children,
}: React.PropsWithChildren<{
  description?: string;
  suggestions?: string[];
  boundaryConditions?: string[];
  scrollEnabled?: boolean;
  contentInsetAdjustmentBehavior?:
    | 'always'
    | 'never'
    | 'automatic'
    | 'scrollableAxes'
    | undefined;
  skipLoading?: boolean;
  elements?: {
    title: string;
    description?: string;
    element: ComponentType | ReactElement;
  }[];
}>) {
  const keyboardHeight = useKeyboardHeight();
  const navigation = useAppNavigation();
  return (
    <Page skipLoading={skipLoading}>
      <ScrollView
        maxWidth="100%"
        scrollEnabled={scrollEnabled}
        flex={1}
        marginBottom={keyboardHeight}
        paddingHorizontal="$5"
        contentContainerStyle={{
          paddingTop: 20,
          paddingBottom: 280,
        }}
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      >
        <Stack marginHorizontal="auto" maxWidth="100%" width={576} gap="$6">
          <XStack>
            <IconButton
              icon="HomeLineOutline"
              onPress={() => {
                // refresh page lost navigation back button, so add it here
                navigation.dispatch(
                  StackActions.replace(ERootRoutes.Main, {
                    screen: ETabRoutes.Developer,
                    params: {
                      screen: ETabDeveloperRoutes.TabDeveloper,
                    },
                  }),
                );
                // navigation.navigate();
                // navigation.navigate('Home');
                // urlAccountNavigation.replaceHomePage(navigation);
              }}
            />
            <Button
              ml="$4"
              onPress={async () => {
                await backgroundApiProxy.serviceSetting.setTheme('light');
              }}
            >
              Light Theme
            </Button>
            <Button
              ml="$4"
              variant="primary"
              onPress={async () => {
                await backgroundApiProxy.serviceSetting.setTheme('dark');
              }}
            >
              Dark Theme
            </Button>
          </XStack>
          {description ? (
            <Stack gap="$2">
              <Stack>
                <SizableText size="$headingXl">使用说明</SizableText>
              </Stack>
              <Stack>
                <FormattedText text={description} />
              </Stack>
            </Stack>
          ) : null}
          {suggestions ? (
            <Stack gap="$2">
              <Stack>
                <SizableText size="$headingXl">使用建议</SizableText>
              </Stack>
              <FormattedText text={suggestions} />
            </Stack>
          ) : null}
          {boundaryConditions?.length > 0 ? (
            <Stack gap="$2">
              <Stack>
                <SizableText size="$headingXl">注意事项</SizableText>
              </Stack>
              <FormattedText text={boundaryConditions} />
            </Stack>
          ) : null}
          <Stack gap="$2">
            <Stack>
              <SizableText size="$headingXl">组件案例</SizableText>
            </Stack>
            <Stack>
              {elements?.map((item, index) => (
                <Stack
                  gap="$2"
                  key={`elements-${index}`}
                  pb="$8"
                  mb="$8"
                  borderBottomWidth="$px"
                  borderBottomColor="$borderSubdued"
                >
                  <Stack flexDirection="column">
                    <SizableText size="$headingLg">{item.title}</SizableText>
                    {item.description ? (
                      <Stack paddingTop={1}>
                        <SizableText>{item.description}。</SizableText>
                      </Stack>
                    ) : null}
                  </Stack>
                  <Stack>
                    {typeof item.element === 'function' ? (
                      <item.element />
                    ) : (
                      item.element
                    )}
                  </Stack>
                </Stack>
              ))}
            </Stack>
            <Stack>
              {children ? <Stack gap="$3">{children}</Stack> : null}
            </Stack>
          </Stack>
        </Stack>
      </ScrollView>
    </Page>
  );
}
