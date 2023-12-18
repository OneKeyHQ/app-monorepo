import {
  Heading,
  Input,
  Page,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../../router/type';

const phrases: string[] = [
  'abandon',
  'ability',
  'able',
  'about',
  'above',
  'absent',
  'absorb',
  'abstract',
  'absurd',
  'abuse',
  'access',
  'accident',
];

export function RecoveryPhrase() {
  const media = useMedia();
  const navigation = useAppNavigation();

  const handleConfirmPress = () => {
    navigation.push(EOnboardingPages.FinalizeWalletSetup);
  };

  return (
    <Page scrollEnabled>
      <Page.Header />
      <Page.Body p="$5" pt="$0">
        <Heading
          pt="$2"
          pb="$4"
          px="$1"
          size="$heading3xl"
          $md={{ size: '$heading2xl' }}
        >
          Write down your phrases in order
        </Heading>
        <XStack flexWrap="wrap" mx="$-1">
          {phrases.map((phrase, index) => (
            <Stack
              key={index}
              $md={{
                flexBasis: '50%',
              }}
              flexBasis="33.33%"
              p="$1"
            >
              <Input
                value={phrase}
                editable={false}
                size={media.md ? 'large' : 'medium'}
                leftAddOnProps={{
                  label: `${index + 1}`,
                  minWidth: '$10',
                  justifyContent: 'center',
                }}
              />
            </Stack>
          ))}
        </XStack>
      </Page.Body>
      <Page.Footer
        onConfirmText="I've Saved the Phrase"
        onConfirm={handleConfirmPress}
      />
    </Page>
  );
}
