import { ScrollView, Stack, Text } from 'tamagui';

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
      <Stack space={1}>
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
      <Stack space={6}>
        {description && (
          <Stack space={2}>
            <Stack>
              <Text typography="PageHeading">使用说明</Text>
            </Stack>
            <Stack>
              <FormattedText text={description} />
            </Stack>
          </Stack>
        )}
        {suggestions && (
          <Stack space={2}>
            <Stack>
              <Text typography="PageHeading">使用建议</Text>
            </Stack>
            <FormattedText text={suggestions} />
          </Stack>
        )}
        {boundaryConditions?.length > 0 && (
          <Stack space={2}>
            <Stack>
              <Text typography="PageHeading">注意事项</Text>
            </Stack>
            <FormattedText text={boundaryConditions} />
          </Stack>
        )}
        <Stack space={2}>
          <Stack>
            <Text typography="PageHeading">组件案例</Text>
          </Stack>
          <Stack space={4}>
            {elements?.map((item) => (
              <Stack space={2}>
                <Stack flexDirection="column">
                  <Text typography="Heading">{item.title}</Text>
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
          <Stack>{children && <Stack space={3}>{children}</Stack>}</Stack>
        </Stack>
      </Stack>
    </ScrollView>
  );
}
