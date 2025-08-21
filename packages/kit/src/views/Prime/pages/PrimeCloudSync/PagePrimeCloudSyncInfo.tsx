import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Icon,
  Page,
  SegmentControl,
  SizableText,
  Stack,
  UnOrderedList,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { Section } from '@onekeyhq/kit/src/components/Section';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

interface IListItemConfig {
  title: string;
  description?: string;
  titleSize?: ISizableTextProps['size'];
}

interface ISectionConfig {
  title: string;
  items: IListItemConfig[];
}

function IncludedDataContent() {
  const intl = useIntl();

  const defaultItemProps = {
    icon: 'CheckRadioSolid' as IIconProps['name'],
    iconProps: { color: '$iconSuccess' as IIconProps['color'] },
  };

  const sectionsConfig: ISectionConfig[] = [
    {
      title: intl.formatMessage({
        id: ETranslations.global_wallet,
      }),
      items: [
        {
          title: intl.formatMessage({
            id: ETranslations.prime_wallet_list,
          }),
          description: intl.formatMessage({
            id: ETranslations.prime_wallet_list_description,
          }),
        },
        {
          title: intl.formatMessage({
            id: ETranslations.prime_custom_token_n_network,
          }),
        },
      ],
    },
    {
      title: intl.formatMessage({
        id: ETranslations.global_browser,
      }),
      items: [
        {
          title: intl.formatMessage({
            id: ETranslations.explore_bookmarks,
          }),
        },
      ],
    },
    {
      title: intl.formatMessage({
        id: ETranslations.global_market,
      }),
      items: [
        {
          title: intl.formatMessage({
            id: ETranslations.global_watchlist,
          }),
        },
      ],
    },
    {
      title: intl.formatMessage({
        id: ETranslations.global_settings,
      }),
      items: [
        {
          title: intl.formatMessage({
            id: ETranslations.settings_address_book,
          }),
        },
        {
          title: intl.formatMessage({
            id: ETranslations.custom_rpc_title,
          }),
        },
      ],
    },
  ];

  return (
    <Stack>
      <Stack gap="$1.5">
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

      {sectionsConfig.map((section, sectionIndex) => (
        <Section
          key={`section-${sectionIndex}`}
          title={section.title}
          titleProps={{
            paddingLeft: 0,
          }}
        >
          <UnOrderedList>
            {section.items.map((item, index) => (
              <UnOrderedList.Item
                key={`item-${sectionIndex}-${index}`}
                {...defaultItemProps}
                titleSize="$bodyLgMedium"
                description={item.description}
                style={{
                  paddingTop: index !== 0 ? 8 : 0,
                }}
              >
                {item.title}
              </UnOrderedList.Item>
            ))}
          </UnOrderedList>
        </Section>
      ))}
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
      pressStyle={{
        bg: '$bgActive',
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

  const defaultItemProps = {
    icon: 'CheckRadioSolid' as IIconProps['name'],
    iconProps: { color: '$iconSuccess' as IIconProps['color'] },
  };

  const securityFeatures = [
    {
      title: intl.formatMessage({
        id: ETranslations.prime_cloud_sync_security_feature_one,
      }),
    },
    {
      title: intl.formatMessage({
        id: ETranslations.prime_cloud_sync_security_feature_two,
      }),
    },
    {
      title: intl.formatMessage({
        id: ETranslations.prime_cloud_sync_security_feature_three,
      }),
    },
    {
      title: intl.formatMessage({
        id: ETranslations.prime_cloud_sync_security_feature_four,
      }),
    },
    {
      title: intl.formatMessage({
        id: ETranslations.prime_cloud_sync_security_feature_five,
      }),
    },
  ];

  return (
    <Stack gap="$4">
      <YStack gap="$1.5">
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
      </YStack>

      <Alert
        type="warning"
        icon="MessageExclamationOutline"
        description={intl.formatMessage({
          id: ETranslations.prime_password_as_key_warning,
        })}
      />

      <UnOrderedList>
        {securityFeatures.map((feature, index) => (
          <UnOrderedList.Item
            key={`security-feature-${index}`}
            titleSize="$bodyLgMedium"
            style={{
              paddingTop: index !== 0 ? 8 : 0,
            }}
            {...defaultItemProps}
          >
            {feature.title}
          </UnOrderedList.Item>
        ))}
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
          link="https://github.com/OneKeyHQ/e2ee-server/tree/main/packages/cloud-sync-server"
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
        <Stack px="$5" pt="$2" pb="$5" gap="$5">
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
