import { ScrollView, Stack, Text } from 'tamagui';

import { Typography } from '@onekeyhq/components';

const FormattedText = ({ text }: { text: string | string[] }) => {
  if (typeof text === 'string') {
    return (
      <Stack>
        <Text>{text}。 </Text>
      </Stack>
    );
  }
  return (
    <Stack>
      <Stack space={4}>
        {text.map((item, index) => (
          <Stack>
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
  return (
    <ScrollView
      flex={1}
      marginHorizontal={10}
      contentContainerStyle={{ alignItems: 'center', paddingBottom: 280 }}
    >
      <Stack space={24}>
        {description && (
          <Stack space={8}>
            <Stack>
              <Typography.PageHeading>使用说明</Typography.PageHeading>
            </Stack>
            <Stack>
              <FormattedText text={description} />
            </Stack>
          </Stack>
        )}
        {suggestions && (
          <Stack space={8}>
            <Stack>
              <Typography.PageHeading>使用建议</Typography.PageHeading>
            </Stack>
            <FormattedText text={suggestions} />
          </Stack>
        )}
        {boundaryConditions?.length > 0 && (
          <Stack space={8}>
            <Stack>
              <Typography.PageHeading>注意事项</Typography.PageHeading>
            </Stack>
            <FormattedText text={boundaryConditions} />
          </Stack>
        )}
        <Stack space={8}>
          <Stack>
            <Typography.PageHeading>组件案例</Typography.PageHeading>
          </Stack>
          <Stack space={16}>
            {elements?.map((item) => (
              <Stack space={8}>
                <Stack flexDirection="column">
                  <Typography.Heading>{item.title}</Typography.Heading>
                  {item.description && (
                    <Stack paddingTop={1}>
                      <Text>{item.description}。</Text>
                    </Stack>
                  )}
                </Stack>
                <Stack>{item.element}</Stack>
              </Stack>
            ))}
          </Stack>
          <Stack>{children && <Stack space={12}>{children}</Stack>}</Stack>
        </Stack>
      </Stack>
    </ScrollView>
  );
}
