import {
  Divider,
  Group,
  Heading,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';

const steps = [
  {
    title: 'Select "Create New Wallet"',
    description:
      'Ea Lorem cillum est fugiat amet proident dolor dolore esse non. Eu fugiat reprehenderit commodo.',
  },
  {
    title: 'Write down all recovery phrase',
    description:
      'Follow the prompts copy down all words and complete the check.',
  },
  {
    title: 'Set PIN',
    description:
      'Set a PIN code yourself, which is similar to the withdrawal code of a bank card.',
  },
];

export function SetupNewWallet() {
  const navigation = useAppNavigation();

  const handleConfirmPress = () => {
    navigation.pop();
  };

  return (
    <Page scrollEnabled>
      <Page.Header title="Set Up New Wallet" />
      <Page.Body px="$5">
        <Group separator={<Divider />}>
          {steps.map(({ title, description }, index) => (
            <Group.Item>
              <Stack
                $gtMd={{
                  flexDirection: 'row',
                }}
                py="$5"
                key={title}
                {...(index === 0 && {
                  pt: '$0',
                })}
              >
                <Stack w="$56" h="$36" bg="$bgSubdued" borderRadius="$3" />
                <Stack
                  flex={1}
                  pt="$5"
                  $gtMd={{
                    pt: 0,
                    pl: '$5',
                  }}
                >
                  <Heading size="$headingMd">{title}</Heading>
                  <SizableText color="$textSubdued" mt="$1">
                    {description}
                  </SizableText>
                </Stack>
              </Stack>
            </Group.Item>
          ))}
        </Group>
      </Page.Body>
      <Page.Footer onConfirmText="OK, Done!" onConfirm={handleConfirmPress} />
    </Page>
  );
}
