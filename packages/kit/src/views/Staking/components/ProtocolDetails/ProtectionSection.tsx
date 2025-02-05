import { useIntl } from 'react-intl';

import {
  Accordion,
  Dialog,
  Divider,
  Icon,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

function AutoRiskControlContent() {
  const intl = useIntl();
  const Content = (
    <YStack gap="$4">
      <YStack gap="$3">
        <XStack alignItems="flex-start">
          <SizableText size="$bodyLg" flex={1}>
            1.{' '}
            {intl.formatMessage({
              id: ETranslations.earn_auto_risk_control_desc_1,
            })}
          </SizableText>
        </XStack>

        <XStack alignItems="flex-start">
          <SizableText size="$bodyLg" flex={1}>
            2.{' '}
            {intl.formatMessage({
              id: ETranslations.earn_auto_risk_control_desc_2,
            })}
          </SizableText>
        </XStack>

        <XStack alignItems="flex-start">
          <SizableText size="$bodyLg" flex={1}>
            3.{' '}
            {intl.formatMessage({
              id: ETranslations.earn_auto_risk_control_desc_3,
            })}
          </SizableText>
        </XStack>
      </YStack>

      <Accordion type="single" collapsible>
        <Accordion.Item value="disclaimer">
          <Accordion.Trigger
            unstyled
            flexDirection="row"
            alignItems="center"
            borderWidth={0}
            bg="$transparent"
            p="$0"
          >
            {({ open }: { open: boolean }) => (
              <XStack alignItems="center" gap="$1">
                <SizableText
                  textAlign="left"
                  size="$bodyMd"
                  color="$textSubdued"
                >
                  {intl.formatMessage({
                    id: ETranslations.earn_disclaimer,
                  })}
                </SizableText>
                <YStack animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$5"
                  />
                </YStack>
              </XStack>
            )}
          </Accordion.Trigger>
          <Accordion.Content unstyled pt="$2">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.earn_auto_risk_control_disclaimer,
              })}
            </SizableText>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </YStack>
  );
  if (platformEnv.isExtensionUiPopup) {
    return <ScrollView h={260}>{Content}</ScrollView>;
  }

  return Content;
}

export function showAutoRiskControlDialog({
  title,
  confirmText,
}: {
  title: string;
  confirmText: string;
}) {
  return Dialog.show({
    icon: 'ShieldCheckDoneOutline',
    tone: 'success',
    title,
    renderContent: <AutoRiskControlContent />,
    onConfirmText: confirmText,
    showCancelButton: false,
    confirmButtonProps: {
      variant: 'secondary',
    },
    showFooter: true,
    disableDrag: platformEnv.isExtensionUiPopup,
  });
}

export const ProtectionSection = ({
  details,
}: {
  details?: IStakeProtocolDetails;
}) => {
  const intl = useIntl();
  if (
    !details ||
    !earnUtils.isMorphoProvider({
      providerName: details.provider.name,
    })
  ) {
    return null;
  }
  return (
    <>
      <YStack>
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.earn_protection,
          })}
        </SizableText>
        <XStack mx="$-5" mt="$4">
          <ListItem
            gap="$3"
            flex={1}
            alignItems="center"
            justifyContent="space-between"
            userSelect="none"
            onPress={() => {
              showAutoRiskControlDialog({
                title: intl.formatMessage({
                  id: ETranslations.earn_auto_risk_control,
                }),
                confirmText: intl.formatMessage({
                  id: ETranslations.explore_got_it,
                }),
              });
            }}
          >
            <XStack gap="$3" alignItems="center" flex={1} pr="$3">
              <Icon
                name="ShieldCheckDoneOutline"
                size="$6"
                color="$iconSuccess"
              />
              <YStack flex={1}>
                <SizableText size="$bodyMdMedium" color="$text">
                  {intl.formatMessage({
                    id: ETranslations.earn_auto_risk_control,
                  })}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.earn_auto_risk_control_subtitle,
                  })}
                </SizableText>
              </YStack>
            </XStack>
            <Icon
              name="ChevronRightSmallOutline"
              size="$6"
              color="$iconSubdued"
            />
          </ListItem>
        </XStack>
      </YStack>
      <Divider />
    </>
  );
};
