import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Icon,
  Page,
  ScrollView,
  SegmentControl,
  SizableText,
  Stack,
  UnOrderedList,
} from '@onekeyhq/components';
import { Section } from '@onekeyhq/kit/src/components/Section';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

function IncludedDataContent() {
  const intl = useIntl();

  const sectionProps = {
    titleProps: {
      paddingHorizontal: 0,
    },
  };

  return (
    <Stack>
      <Stack gap="$4">
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.prime_what_data_included,
          })}
        </SizableText>
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.prime_what_data_included_description_long,
          })}
        </SizableText>
      </Stack>

      <Section
        title={intl.formatMessage({
          id: ETranslations.global_wallet,
        })}
        {...sectionProps}
      >
        <UnOrderedList>
          <UnOrderedList.Item
            icon="CheckRadioSolid"
            iconProps={{ color: '$iconSuccess' }}
          >
            {intl.formatMessage({
              id: ETranslations.prime_wallet_list,
            })}
          </UnOrderedList.Item>
          <UnOrderedList.Item
            icon="CheckRadioSolid"
            iconProps={{ color: '$iconSuccess' }}
          >
            {intl.formatMessage({
              id: ETranslations.prime_custom_token_n_network,
            })}
          </UnOrderedList.Item>
        </UnOrderedList>
      </Section>

      <Section
        title={intl.formatMessage({
          id: ETranslations.global_browser,
        })}
        {...sectionProps}
      >
        <UnOrderedList>
          <UnOrderedList.Item
            icon="CheckRadioSolid"
            iconProps={{ color: '$iconSuccess' }}
          >
            {intl.formatMessage({
              id: ETranslations.explore_bookmarks,
            })}
          </UnOrderedList.Item>
        </UnOrderedList>
      </Section>

      <Section
        title={intl.formatMessage({
          id: ETranslations.global_market,
        })}
        {...sectionProps}
      >
        <UnOrderedList>
          <UnOrderedList.Item
            icon="CheckRadioSolid"
            iconProps={{ color: '$iconSuccess' }}
          >
            {intl.formatMessage({
              id: ETranslations.global_watchlist,
            })}
          </UnOrderedList.Item>
        </UnOrderedList>
      </Section>

      <Section
        title={intl.formatMessage({
          id: ETranslations.global_settings,
        })}
        {...sectionProps}
      >
        <UnOrderedList>
          <UnOrderedList.Item
            icon="CheckRadioSolid"
            iconProps={{ color: '$iconSuccess' }}
          >
            {intl.formatMessage({
              id: ETranslations.settings_address_book,
            })}
          </UnOrderedList.Item>
          <UnOrderedList.Item
            icon="CheckRadioSolid"
            iconProps={{ color: '$iconSuccess' }}
          >
            {intl.formatMessage({
              id: ETranslations.custom_rpc_title,
            })}
          </UnOrderedList.Item>
        </UnOrderedList>
      </Section>
    </Stack>
  );
}

function SourceCodeLink({
  title,
  description,
  link,
}: {
  title: string;
  description: string;
  link: string;
}) {
  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      flex={1}
      bg="$bgStrong"
      p="$3"
      borderRadius="$3"
      cursor="pointer"
      hoverStyle={{
        bg: '$bgSubdued',
      }}
      onPress={() => {
        openUrlUtils.openUrlExternal(link);
      }}
    >
      <Stack flex={1}>
        <SizableText fontWeight="600">{title}</SizableText>
        <SizableText color="$textSubdued" size="$bodyMd">
          {description}
        </SizableText>
      </Stack>
      <Icon name="OpenOutline" size="$5" color="$iconSubdued" />
    </Stack>
  );
}

function SecurityContent() {
  return (
    <Stack gap="$4">
      <SizableText size="$headingMd" fontWeight="600">
        End-to-end encryption protection
      </SizableText>

      <SizableText color="$textSubdued">
        Your data is encrypted locally with a OneKey ID password before being
        uploaded to the cloud, only you can decrypt the data, not even OneKey.
      </SizableText>

      <Alert
        type="warning"
        icon="MessageExclamationOutline"
        description="The OneKey ID password is your encryption key. Forgetting the password will not recover data."
      />

      <UnOrderedList>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          AES 256-bit encryption algorithm
        </UnOrderedList.Item>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          PBKDF2 key derivation (anti-brute force)
        </UnOrderedList.Item>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          Local encryption, server zero-knowledge
        </UnOrderedList.Item>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          12-character strong password constraint
        </UnOrderedList.Item>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          Completely open source, auditable
        </UnOrderedList.Item>
      </UnOrderedList>

      <Stack flexDirection="row" gap="$3" mt="$4">
        <SourceCodeLink
          title="Client-side"
          description="Source code"
          link="https://github.com/OneKeyHQ/app-monorepo"
        />

        <SourceCodeLink
          title="Server-side"
          description="Source code"
          link="https://github.com/OneKeyHQ/app-monorepo"
        />
      </Stack>
    </Stack>
  );
}

export default function PagePrimeCloudSyncInfo() {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useState<'included' | 'security'>(
    'included',
  );

  const options = [
    {
      label: 'Included data',
      value: 'included',
    },
    {
      label: intl.formatMessage({
        id: ETranslations.global_security,
      }),
      value: 'security',
    },
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case 'included':
        return <IncludedDataContent />;
      case 'security':
        return <SecurityContent />;
      default:
        return <IncludedDataContent />;
    }
  };

  return (
    <Page>
      <Page.Header title="About cloud sync" />
      <Page.Body>
        <Stack p="$5" gap="$5">
          <SegmentControl
            fullWidth
            value={selectedTab}
            onChange={(value) =>
              setSelectedTab(value as 'included' | 'security')
            }
            options={options}
          />
          <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            {renderContent()}
          </ScrollView>
        </Stack>
      </Page.Body>
    </Page>
  );
}
