import type { ComponentProps, ReactElement } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText, Stack, YStack } from '@onekeyhq/components';
import { BIP39_DOT_MAP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { RatioImage } from '../../components/RatioImage';

const BackupStep = ({
  title,
  desc,
  image,
  index,
}: {
  index: number;
  title: string;
  desc: (string | JSX.Element)[];
  image: ComponentProps<typeof RatioImage>;
}) => (
  <Stack position="relative">
    <Stack borderRadius={12} overflow="hidden" mb="$5">
      <RatioImage {...image} />
    </Stack>
    <Stack
      width="$5"
      height="$5"
      backgroundColor="$bgInfo"
      position="absolute"
      top={10}
      left={10}
      justifyContent="center"
      alignItems="center"
      display="flex"
      borderRadius={5}
    >
      <SizableText size="$bodySmMedium" color="$textInfo">
        {index}
      </SizableText>
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

const BackupDocs = () => {
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_backup_with_onekey_keytag,
        })}
      />
      <Page.Body>
        <YStack p="$5" separator={<Stack h="$10" />}>
          <BackupStep
            index={1}
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
            title={intl.formatMessage({
              id: ETranslations.settings_step1_get_bip39_dotmap,
            })}
            desc={[
              <SizableText key="1" size="$bodyLg" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.settings_step1_get_bip39_dotmap_desc,
                  },
                  {
                    'dotmap': (
                      <SizableText
                        size="$bodyLg"
                        color="$textSubdued"
                        textDecorationLine="underline"
                        onPress={() => {
                          openUrlExternal(BIP39_DOT_MAP_URL);
                        }}
                      >
                        BIP39-Dotmap
                      </SizableText>
                    ),
                  },
                )}
              </SizableText>,
            ]}
          />
          <BackupStep
            index={2}
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
            title={intl.formatMessage({
              id: ETranslations.settings_step2_match_recovery_phrase_dots,
            })}
            desc={[
              intl.formatMessage(
                {
                  id: ETranslations.settings_step2_match_recovery_phrase_dots_desc,
                },
                {
                  'dotmap': (
                    <SizableText
                      size="$bodyLg"
                      color="$textSubdued"
                      textDecorationLine="underline"
                      onPress={() => {
                        openUrlExternal(BIP39_DOT_MAP_URL);
                      }}
                    >
                      BIP39-Dotmap
                    </SizableText>
                  ),
                },
              ) as JSX.Element,
            ]}
          />
          <BackupStep
            index={3}
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
            title={intl.formatMessage({
              id: ETranslations.settings_step3_align_and_punch,
            })}
            desc={[
              intl.formatMessage({
                id: ETranslations.settings_step3_align_and_punch_desc,
              }),
            ]}
          />
        </YStack>
      </Page.Body>
    </Page>
  );
};

export default BackupDocs;
