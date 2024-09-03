import { useIntl } from 'react-intl';

import { Dialog, Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

import { DAppRiskyAlertDetail } from '../../../DAppConnection/components/DAppRequestLayout/DAppRiskyAlertDetail';
import { ChunkedItem } from '../ChunkedItem';

export function DappInfoPopoverContent({
  hostSecurity,
  closePopover,
}: {
  hostSecurity?: IHostSecurity;
  closePopover: () => void;
}) {
  const intl = useIntl();
  return (
    <Stack
      onPress={(e) => {
        e.stopPropagation();
      }}
    >
      <ChunkedItem
        item={{
          dappId: '',
          logo: '',
          name: hostSecurity?.projectName ?? '',
          url: '',
          originLogo: '',
          description: '',
          networkIds: [],
          tags: [],
          categories: [],
        }}
        isExploreView={false}
      />
      <Stack p="$5" pt="$2">
        <SizableText mb="$3" size="$headingMd">
          {intl.formatMessage({
            id: ETranslations.browser_dapp_listed_by,
          })}
        </SizableText>
        <SizableText mb="$3" size="$headingMd">
          {intl.formatMessage({
            id: ETranslations.browser_risk_detection,
          })}
        </SizableText>
        <XStack ai="center">
          <Icon name="BadgeVerifiedSolid" color="$iconSuccess" />
          <Stack ml="$3" flex={1}>
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.dapp_connect_verified_site,
              })}
            </SizableText>
            <SizableText size="$bodyMd">
              {intl.formatMessage(
                {
                  id: ETranslations.global_from_provider,
                },
                {
                  provider: 'From GoPlus & Blockaid',
                },
              )}
            </SizableText>
          </Stack>
          <XStack
            ai="center"
            onPress={() => {
              closePopover();
              Dialog.show({
                title: hostSecurity?.host,
                renderContent: (
                  <DAppRiskyAlertDetail urlSecurityInfo={hostSecurity} />
                ),
                showFooter: false,
              });
            }}
          >
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.global_details,
              })}
            </SizableText>
            <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
          </XStack>
        </XStack>
      </Stack>
    </Stack>
  );
}
