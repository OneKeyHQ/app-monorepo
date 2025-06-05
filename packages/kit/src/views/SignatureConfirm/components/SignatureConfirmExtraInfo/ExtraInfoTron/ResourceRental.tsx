import { StyleSheet } from 'react-native';

import type { IDialogShowProps } from '@onekeyhq/components';
import {
  Accordion,
  Badge,
  Dialog,
  Icon,
  IconButton,
  SizableText,
  Stack,
  Switch,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

const showResourceRentalDetailsDialog = ({
  title,
  description,
  content,
  ...dialogProps
}: IDialogShowProps & {
  title: string;
  description: string;
  content: React.ReactNode;
}) =>
  Dialog.show({
    title,
    description,
    icon: 'FlashOutline',
    renderContent: content,
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_ok,
    }),
    onConfirm: async ({ close }) => {
      await close();
    },
    ...dialogProps,
  });

function ResourceRental() {
  return (
    <YStack gap="$1">
      <SignatureConfirmItem.Block>
        <XStack alignItems="center" gap="$2" justifyContent="space-between">
          <YStack flex={1} gap="$1">
            <XStack alignItems="center" gap="$1.5">
              <SizableText size="$bodySm" color="$textSubdued">
                Energy Rental
              </SizableText>
              <Badge badgeSize="sm" badgeType="success">
                Save 10.23 TRX
              </Badge>
              <Badge badgeSize="sm" badgeType="success">
                Pay with USDT
              </Badge>
              <Stack
                {...listItemPressStyle}
                borderRadius="$full"
                onPress={() =>
                  showResourceRentalDetailsDialog({
                    title: 'Energy Rental',
                    description:
                      'Low energy detected. Energy rental was enabled to reduce fees. You can cancel it anytime.',
                    content: (
                      <SizableText size="$bodySm" color="$textSubdued">
                        Learn more
                      </SizableText>
                    ),
                  })
                }
              >
                <Icon
                  name="InfoCircleOutline"
                  size="$4.5"
                  color="$iconSubdued"
                />
              </Stack>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              Low energy detected. Energy rental was enabled to reduce fees.
            </SizableText>
          </YStack>
          <Switch size="large" />
        </XStack>
      </SignatureConfirmItem.Block>
      <Accordion
        overflow="hidden"
        width="100%"
        type="single"
        collapsible
        defaultValue=""
        borderRadius="$2"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        backgroundColor="$bgSubdued"
      >
        <Accordion.Item value="a1">
          <Accordion.Trigger
            flexDirection="row"
            justifyContent="space-between"
            px="$3"
            py="$2"
            backgroundColor="$bgSubdued"
            borderWidth={0}
          >
            {({ open }: { open: boolean }) => (
              <XStack
                flex={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <SizableText size="$bodySm" color="$textSubdued">
                  Get some TRX for future fees？
                </SizableText>
                <View
                  animation="quick"
                  rotate={open ? '180deg' : '0deg'}
                  transformOrigin="center"
                >
                  <Icon name="ChevronDownSmallOutline" size="$6" />
                </View>
              </XStack>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content
              backgroundColor="$bgSubdued"
              animation="quick"
              exitStyle={{ opacity: 0 }}
            >
              <XStack
                alignItems="center"
                gap="$2"
                justifyContent="space-between"
              >
                <YStack>
                  <XStack alignItems="center" gap="$1.5">
                    <SizableText size="$bodySm" color="$textSubdued">
                      Exchange USDT for 20 TRX
                    </SizableText>
                    <Stack
                      borderRadius="$full"
                      {...listItemPressStyle}
                      onPress={() =>
                        showResourceRentalDetailsDialog({
                          title: 'Exchange USDT for 20 TRX',
                          description:
                            'If you don’t have enough TRX, you can choose to use USDT to rent energy. USDT payments cost more than TRX. You may opt to receive part of your payment as TRX for future use.',
                          content: (
                            <SizableText size="$bodySm" color="$textSubdued">
                              Exchange rate: 1 USDT = 3.578074 TRX
                            </SizableText>
                          ),
                        })
                      }
                    >
                      <Icon
                        name="InfoCircleOutline"
                        size="$4.5"
                        color="$iconSubdued"
                      />
                    </Stack>
                  </XStack>
                  <SizableText size="$bodySm" color="$textSubdued">
                    5.98 USDT → 20 TRX
                  </SizableText>
                </YStack>
                <Switch size="large" />
              </XStack>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </YStack>
  );
}

export default ResourceRental;
