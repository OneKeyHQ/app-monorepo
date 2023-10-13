import { useDispatch } from 'react-redux';
import { ScrollView } from 'tamagui';

import { Button, Stack, Text, XStack } from '@onekeyhq/components';

import { setTheme } from '../../../../store/reducers/settings';

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
  children,
}: React.PropsWithChildren<{
  description?: string;
  suggestions?: string[];
  boundaryConditions?: string[];
  elements?: {
    title: string;
    description?: string;
    element: React.ReactElement;
  }[];
}>) {
  const dispatch = useDispatch();
  return (
    <ScrollView
      maxWidth="100%"
      flex={1}
      paddingHorizontal="$5"
      contentContainerStyle={{
        paddingTop: 20,
        paddingBottom: 280,
      }}
    >
      <XStack padding="$4" display="flex" justifyContent="center">
        <Button
          onPress={() => {
            dispatch(setTheme('light'));
          }}
        >
          <Button.Text>Light Theme</Button.Text>
        </Button>
        <Button
          ml="$4"
          buttonVariant="primary"
          onPress={() => {
            dispatch(setTheme('dark'));
          }}
        >
          <Button.Text>Night Theme</Button.Text>
        </Button>
      </XStack>
      <Stack marginHorizontal="auto" maxWidth="100%" width={576} space="$6">
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
          <Stack space="$4">
            {elements?.map((item, index) => (
              <Stack space="$2" key={`elements-${index}`}>
                <Stack flexDirection="column">
                  <Text variant="$headingLg">{item.title}</Text>
                  {item.description && (
                    <Stack paddingTop={1}>
                      <Text>{item.description}。</Text>
                    </Stack>
                  )}
                </Stack>
                <Stack>
                  {item.element}
                </Stack>
              </Stack>
            ))}
          </Stack>
          <Stack>{children && <Stack space="$3">{children}</Stack>}</Stack>
        </Stack>
      </Stack>
    </ScrollView>
  );
}
