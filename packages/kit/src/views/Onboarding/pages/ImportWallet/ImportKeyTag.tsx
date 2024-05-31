import { useCallback, useMemo } from 'react';

import { Image, Page, SizableText, Stack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { BIP39_DOT_MAP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { PhaseInputArea } from '../../components/PhaseInputArea';

const KeyTagFooterComponent = () => {
  const onPress = useCallback(() => {
    openUrlExternal(BIP39_DOT_MAP_URL);
  }, []);
  return (
    <YStack px="$5" mt="$10">
      <SizableText size="$headingSm" color="$textSubdued">
        How to import from OneKey KeyTag?
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        Sum the numbers in each row. This sum represents the word's position in
        the word list.
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        Then, visit the
        <SizableText
          textDecorationLine="underline"
          size="$bodyMd"
          onPress={onPress}
          color="$textSubdued"
          px="$1"
        >
          {' '}
          BIP39-DotMap{' '}
        </SizableText>
        website to find the corresponding word for this position.
      </SizableText>
      <Stack borderRadius={12} mt="$5" overflow="hidden">
        <Stack width="100%" $sm={{ height: 224 }} height={300}>
          <Image
            width="100%"
            height="100%"
            source={require('@onekeyhq/kit/assets/keytag/bip39-dotmap.png')}
          />
        </Stack>
      </Stack>
    </YStack>
  );
};

export function ImportKeyTag() {
  const navigation = useAppNavigation();

  const handleConfirmPress = useCallback(
    (mnemonic: string) => {
      navigation.push(EOnboardingPages.FinalizeWalletSetup, {
        mnemonic,
      });
    },
    [navigation],
  );

  const renderPhaseInputArea = useMemo(
    () => (
      <PhaseInputArea
        defaultPhrases={[]}
        onConfirm={handleConfirmPress}
        FooterComponent={<KeyTagFooterComponent />}
      />
    ),
    [handleConfirmPress],
  );
  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" />
      {renderPhaseInputArea}
    </Page>
  );
}

export default ImportKeyTag;
