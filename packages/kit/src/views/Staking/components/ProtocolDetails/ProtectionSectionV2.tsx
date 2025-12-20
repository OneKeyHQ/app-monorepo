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
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

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

function showAutoRiskControlDialog({
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
  protection,
}: {
  protection?: IStakeEarnDetail['protection'];
}) => {
  const intl = useIntl();
  if (!protection) {
    return null;
  }
  return (
    <>
      <YStack>
        <SizableText
          size={protection.title.size || '$headingLg'}
          color={protection.title.color}
        >
          {protection.title.text}
        </SizableText>
        <XStack mx="$-5" mt="$4">
          {protection.items.map((item) => {
            return (
              <ListItem
                key={item.title.text}
                gap="$3"
                flex={1}
                alignItems="center"
                justifyContent="space-between"
                userSelect="none"
                onPress={() => {
                  showAutoRiskControlDialog({
                    title: item.title.text,
                    confirmText: intl.formatMessage({
                      id: ETranslations.explore_got_it,
                    }),
                  });
                }}
              >
                <XStack gap="$3" alignItems="center" flex={1} pr="$3">
                  <Icon
                    name={item.icon.icon}
                    size="$6"
                    color={item.icon.color || '$iconSuccess'}
                  />
                  <YStack flex={1}>
                    <SizableText
                      size={item.title.size || '$bodyMdMedium'}
                      color={item.title.color}
                    >
                      {item.title.text}
                    </SizableText>
                    <SizableText
                      size={item.description?.size || '$bodyMd'}
                      color={item.description?.color}
                    >
                      {item.description?.text}
                    </SizableText>
                  </YStack>
                </XStack>
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$6"
                  color="$iconSubdued"
                />
              </ListItem>
            );
          })}
        </XStack>
      </YStack>
      <Divider />
    </>
  );
};
