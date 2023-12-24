import { useCallback, useState } from 'react';

import * as Clipboard from 'expo-clipboard';

import {
  Button,
  Input,
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { Tutorials } from '../../Components';
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

const tutorials = [
  {
    title: "Why Can't I Copy All Phrases Together?",
    description:
      'To prevent malware from capturing clipboard contents, mass copying is disabled for enhanced security.',
  },
  {
    title: 'Why One Word at a Time?',
    description:
      'Limiting display to one word at a time safeguards against screen recording threats.',
  },
];

function FocusDisplayInput({ text, index }: { text: string; index: number }) {
  const media = useMedia();
  const [isFocused, setIsFocused] = useState(false);
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);
  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);
  return (
    <Input
      caretHidden
      showSoftInputOnFocus={false}
      keyboardType="numeric"
      onFocus={handleFocus}
      onBlur={handleBlur}
      value={isFocused ? text : '••••'}
      editable={false}
      size={media.md ? 'large' : 'medium'}
      leftAddOnProps={{
        label: `${index + 1}`,
        minWidth: '$10',
        justifyContent: 'center',
      }}
    />
  );
}

export default function RecoveryPhrase() {
  const navigation = useAppNavigation();

  const handleConfirmPress = () => {
    navigation.push(EOnboardingPages.VerifyRecoverPhrase, {
      phrases,
    });
  };

  return (
    <Page scrollEnabled>
      <Page.Header title="Write Down Your Phrases" />
      <Page.Body p="$5" pt="$0">
        <SizableText pt="$2" pb="$4" px="$1" size="$bodyLgMedium">
          Tap to display words and write down your phrases in order
        </SizableText>
        {platformEnv.isDev ? (
          <XStack px="$1" pb="$4">
            <Button
              size="small"
              variant="tertiary"
              onPress={async () => {
                await Clipboard.setStringAsync(JSON.stringify(phrases));
              }}
            >
              Copy All(Only in Dev)
            </Button>
          </XStack>
        ) : null}
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
              <FocusDisplayInput text={phrase} index={index} />
            </Stack>
          ))}
        </XStack>
        <Tutorials list={tutorials} />
      </Page.Body>
      <Page.Footer
        onConfirmText="I've Saved the Phrase"
        onConfirm={handleConfirmPress}
      />
    </Page>
  );
}
