import type { ComponentType, ReactElement } from 'react';

import {
  Button,
  Page,
  ScrollView,
  Stack,
  Text,
  XStack,
} from '@onekeyhq/components';
import { useKeyboardHeight } from '@onekeyhq/components/src/hooks';

import backgroundApiProxy from '../../../../../../../background/instance/backgroundApiProxy';

const FormattedText = ({ text }: { text: string | string[] }) => {
  if (typeof text === 'string') {
    return (
      <Stack>
        <Text>{text}。 </Text>
      </Stack>
    );
  }
  if (Array.isArray(text) && text.length === 0) {
    return null;
  }
  return (
    <Stack>
      <Stack space="$1">
        {text.map((item, index) => (
          <Stack key={index.toString()}>
            <Text>
              {index + 1}. {item}
              {index === text.length - 1 ? '。' : '；'}
            </Text>
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
        <Stack marginHorizontal="auto" maxWidth="100%" width={576} space="$6">
          <XStack>
            <Button
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
          {description && (
            <Stack space="$2">
              <Stack>
                <Text variant="$headingXl">使用说明</Text>
              </Stack>
              <Stack>
                <FormattedText text={description} />
              </Stack>
            </Stack>
          )}
          {suggestions && (
            <Stack space="$2">
              <Stack>
                <Text variant="$headingXl">使用建议</Text>
              </Stack>
              <FormattedText text={suggestions} />
            </Stack>
          )}
          {boundaryConditions?.length > 0 && (
            <Stack space="$2">
              <Stack>
                <Text variant="$headingXl">注意事项</Text>
              </Stack>
              <FormattedText text={boundaryConditions} />
            </Stack>
          )}
          <Stack space="$2">
            <Stack>
              <Text variant="$headingXl">组件案例</Text>
            </Stack>
            <Stack>
              {elements?.map((item, index) => (
                <Stack
                  space="$2"
                  key={`elements-${index}`}
                  pb="$8"
                  mb="$8"
                  borderBottomWidth="$px"
                  borderBottomColor="$borderSubdued"
                >
                  <Stack flexDirection="column">
                    <Text variant="$headingLg">{item.title}</Text>
                    {item.description && (
                      <Stack paddingTop={1}>
                        <Text>{item.description}。</Text>
                      </Stack>
                    )}
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
            <Stack>{children && <Stack space="$3">{children}</Stack>}</Stack>
          </Stack>
        </Stack>
      </ScrollView>
    </Page>
  );
}
