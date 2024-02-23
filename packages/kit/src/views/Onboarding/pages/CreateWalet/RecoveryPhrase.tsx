import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Input,
  Page,
  SizableText,
  Stack,
  XStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { generateMnemonic } from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { Tutorials } from '../../components';
import { useShowCopyPasteButton } from '../../components/hooks';
import { EOnboardingPages } from '../../router/type';

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

export function RecoveryPhrase() {
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();
  const isShowCopyPasteButton = useShowCopyPasteButton();
  const { servicePassword } = backgroundApiProxy;

  useEffect(() => {
    console.log('RecoveryPhrase useEffect');
  }, []);

  const mnemonic = useMemo(() => {
    console.log('RecoveryPhrase generateMnemonic');
    return generateMnemonic();
  }, []);
  const phrases = useMemo(
    () => mnemonic.split(' ').filter(Boolean),
    [mnemonic],
  );

  const handleConfirmPress = useCallback(async () => {
    navigation.push(EOnboardingPages.VerifyRecoverPhrase, {
      mnemonic: await servicePassword.encodeSensitiveText({
        text: mnemonic,
      }),
    });
  }, [mnemonic, navigation, servicePassword]);

  return (
    <Page scrollEnabled>
      <Page.Header title="Write Down Your Phrases" />
      <Page.Body p="$5" pt="$0">
        <SizableText pt="$2" pb="$4" px="$1" size="$bodyLgMedium">
          Tap to display words and write down your phrases in order
        </SizableText>

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

        {isShowCopyPasteButton ? (
          <XStack px="$5" py="$2">
            <Button
              size="small"
              variant="tertiary"
              onPress={async () => {
                copyText(mnemonic);
              }}
            >
              Copy All(Only in Dev)
            </Button>
          </XStack>
        ) : null}

        <Tutorials list={tutorials} />
      </Page.Body>
      <Page.Footer
        onConfirmText="I've Saved the Phrase"
        onConfirm={handleConfirmPress}
      />
    </Page>
  );
}

export default RecoveryPhrase;
