import { Row } from 'native-base';

import { ScrollView, Stack, Text } from '@onekeyhq/components';

const FormattedText = ({ text }: { text: string | string[] }) => {
  if (typeof text === 'string') {
    return (
      <Row>
        <Text>{text}。 </Text>
      </Row>
    );
  }
  return (
    <Row>
      <Stack space={1}>
        {text.map((item, index) => (
          <Row>
            <Text>
              {index + 1}. {item}
              {index === text.length - 1 ? '。' : '；'}
            </Text>
          </Row>
        ))}
      </Stack>
    </Row>
  );
};

export function Layout({
  description = '',
  suggestions = [],
  boundaryConditions = [],
  children,
}: React.PropsWithChildren<{
  description?: string;
  suggestions?: string[];
  boundaryConditions?: string[];
}>) {
  return (
    <ScrollView
      flex={1}
      padding={10}
      contentContainerStyle={{ alignItems: 'center' }}
    >
      <Stack space={6}>
        {description && (
          <Stack space={2}>
            <Row>
              <Text typography="Heading">使用说明</Text>
            </Row>
            <Row>
              <FormattedText text={description} />
            </Row>
          </Stack>
        )}
        {suggestions && (
          <Stack space={2}>
            <Row>
              <Text typography="Heading">使用建议</Text>
            </Row>
            <FormattedText text={suggestions} />
          </Stack>
        )}
        {boundaryConditions?.length > 0 && (
          <Stack space={2}>
            <Row>
              <Text typography="Heading">注意事项</Text>
            </Row>
            <FormattedText text={boundaryConditions} />
          </Stack>
        )}
        <Stack space={2}>
          <Row>
            <Text typography="Heading">组件案例</Text>
          </Row>
          <Row>
            <Stack space={3}>{children}</Stack>
          </Row>
        </Stack>
      </Stack>
    </ScrollView>
  );
}
