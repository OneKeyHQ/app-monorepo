import type { ComponentProps } from 'react';

import { Page, SizableText, Stack, YStack } from '@onekeyhq/components';

import { RatioImage } from '../../components/RatioImage';

const BackupStep = ({
  title,
  desc,
  image,
}: {
  title: string;
  desc: string[];
  image: ComponentProps<typeof RatioImage>;
}) => (
  <Stack>
    <Stack borderRadius={12} overflow="hidden" mb="$5">
      <RatioImage {...image} />
    </Stack>
    <SizableText size="$headingMd">{title}</SizableText>
    <YStack mt="$1">
      {desc.map((o, i) => (
        <SizableText key={i} size="$bodyLg" color="$textSubdued">
          {o}
        </SizableText>
      ))}
    </YStack>
  </Stack>
);

const BackupDocs = () => (
  <Page scrollEnabled>
    <Page.Header title="Back Up with OneKey KeyTag" />
    <Page.Body>
      <YStack p="$5" separator={<Stack h="$5" />}>
        <BackupStep
          image={{
            sm: {
              ratio: 353 / 224,
              source: require('@onekeyhq/kit/assets/keytag/keytag_doc_step1_sm.png'),
            },
            base: {
              ratio: 600 / 224,
              source: require('@onekeyhq/kit/assets/keytag/keytag_doc_step1_base.png'),
            },
          }}
          title="Step 1: Get your BIP39 Dotmap"
          desc={[
            'Visit the BIP39-Dotmap online or refer to the physical map in your KeyTag starter guide.',
          ]}
        />
        <BackupStep
          image={{
            sm: {
              ratio: 353 / 224,
              source: require('@onekeyhq/kit/assets/keytag/keytag_doc_step2_sm.png'),
            },
            base: {
              ratio: 600 / 224,
              source: require('@onekeyhq/kit/assets/keytag/keytag_doc_step2_base.png'),
            },
          }}
          title="Step 2: Match recovery phrase dots"
          desc={[
            'Locate the dot pattern for each word of your recovery phrase on the BIP39-Dotmap.',
          ]}
        />
        <BackupStep
          image={{
            sm: {
              ratio: 353 / 224,
              source: require('@onekeyhq/kit/assets/keytag/keytag_doc_step3_sm.png'),
            },
            base: {
              ratio: 600 / 224,
              source: require('@onekeyhq/kit/assets/keytag/keytag_doc_step3_base.png'),
            },
          }}
          title="Step 3: Align and punch"
          desc={[
            "Each line of KeyTag represents a word. Use a center punch tool for accurate punching based on the black circle's position.",
            "For Passphrase backup, punch on the line marked with ' * '.",
          ]}
        />
      </YStack>
    </Page.Body>
  </Page>
);

export default BackupDocs;
