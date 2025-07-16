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
        <SizableText>{title}</SizableText>
        <SizableText color="$textSubdued" size="$bodyMd">
          {description}
        </SizableText>
      </Stack>
      <Icon name="OpenOutline" size="$5" color="$iconSubdued" />
    </Stack>
  );
}

function SecurityContent() {
  const intl = useIntl();

  return (
    <Stack gap="$4">
      <SizableText size="$headingLg">
        {intl.formatMessage({
          id: ETranslations.prime_end_to_end_encryption_protection,
        })}
      </SizableText>

      <SizableText color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.prime_end_to_end_encryption_protection_description,
        })}
      </SizableText>

      <Alert
        type="warning"
        icon="MessageExclamationOutline"
        description={intl.formatMessage({
          id: ETranslations.prime_password_as_key_warning,
        })}
      />

      <UnOrderedList>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          {intl.formatMessage({
            id: ETranslations.prime_cloud_sync_security_feature_one,
          })}
        </UnOrderedList.Item>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          {intl.formatMessage({
            id: ETranslations.prime_cloud_sync_security_feature_two,
          })}
        </UnOrderedList.Item>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          {intl.formatMessage({
            id: ETranslations.prime_cloud_sync_security_feature_three,
          })}
        </UnOrderedList.Item>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          {intl.formatMessage({
            id: ETranslations.prime_cloud_sync_security_feature_four,
          })}
        </UnOrderedList.Item>
        <UnOrderedList.Item
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
        >
          {intl.formatMessage({
            id: ETranslations.prime_cloud_sync_security_feature_five,
          })}
        </UnOrderedList.Item>
      </UnOrderedList>

      <Stack flexDirection="row" gap="$3" mt="$4">
        <SourceCodeLink
          title={intl.formatMessage({
            id: ETranslations.global_client_side,
          })}
          description={intl.formatMessage({
            id: ETranslations.global_source_code,
          })}
          link="https://github.com/OneKeyHQ/app-monorepo"
        />

        <SourceCodeLink
          title={intl.formatMessage({
            id: ETranslations.global_server_side,
          })}
          description={intl.formatMessage({
            id: ETranslations.global_source_code,
          })}
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
      label: intl.formatMessage({
        id: ETranslations.prime_about_cloud_sync_included_data_title,
      }),
      value: 'included',
    },
    {
      label: intl.formatMessage({
        id: ETranslations.prime_about_cloud_sync_security_title,
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
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.prime_about_cloud_sync,
        })}
      />
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
          {renderContent()}
        </Stack>
      </Page.Body>
    </Page>
  );
}
