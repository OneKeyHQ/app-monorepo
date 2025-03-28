import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { Share, StyleSheet } from 'react-native';

import {
  Accordion,
  Button,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  Page,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

function ShareCode() {
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();

  const { result: myReferralCode } = usePromiseResult(
    async () =>
      (await backgroundApiProxy.serviceReferralCode.getMyReferralCode()) ||
      'TEST_CODE',
    [],
    {
      initResult: '',
    },
  );

  const handleCopy = useCallback(() => {
    copyText(myReferralCode);
  }, [copyText, myReferralCode]);

  const toYourReferredPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.YourReferred);
  }, [navigation]);
  const intl = useIntl();
  const sharedUrl = useMemo(
    () => `https://onekey.so/r/${myReferralCode}`,
    [myReferralCode],
  );
  return (
    <YStack px="$5" pt="$6" pb="$8">
      <YStack>
        <XStack jc="space-between">
          <SizableText size="$headingMd">
            {intl.formatMessage({ id: ETranslations.referral_your_code })}
          </SizableText>
          <Button
            onPress={toYourReferredPage}
            variant="tertiary"
            iconAfter="ChevronRightOutline"
            jc="center"
          >
            {intl.formatMessage({ id: ETranslations.referral_referred })}
          </Button>
        </XStack>
        <XStack gap="$3" pt="$2" ai="center">
          <SizableText size="$heading4xl">{myReferralCode}</SizableText>
          <IconButton
            title={intl.formatMessage({ id: ETranslations.global_copy })}
            variant="tertiary"
            icon="Copy3Outline"
            size="large"
            iconColor="$iconSubdued"
            onPress={handleCopy}
          />
        </XStack>
        <XStack
          mt="$2.5"
          borderColor="rgba(0, 0, 0, 0.13)"
          bg="$bgDisabled"
          px="$3"
          py="$1.5"
          borderWidth={StyleSheet.hairlineWidth}
          jc="space-between"
          ai="center"
          borderRadius="$2.5"
        >
          <SizableText size="$bodyLg" flexShrink={1}>
            {`onekey.so/r/${myReferralCode}`}
          </SizableText>
          <XStack ai="center" gap="$2.5">
            <IconButton
              title={intl.formatMessage({ id: ETranslations.global_copy })}
              variant="tertiary"
              icon="Copy3Outline"
              size="large"
              iconColor="$iconSubdued"
              onPress={() => {
                copyText(sharedUrl);
              }}
            />
            {platformEnv.isNative ? (
              <IconButton
                title={intl.formatMessage({ id: ETranslations.global_copy })}
                variant="tertiary"
                icon="ShareOutline"
                size="large"
                iconColor="$iconSubdued"
                onPress={() => {
                  setTimeout(() => {
                    void Share.share(
                      platformEnv.isNativeIOS
                        ? {
                            url: sharedUrl,
                          }
                        : {
                            message: sharedUrl,
                          },
                    );
                  }, 300);
                }}
              />
            ) : null}
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

function Dashboard() {
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const intl = useIntl();
  const currencySymbol = settings.currencyInfo.symbol;

  const toEditAddressPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.EditAddress, {
      onAddressAdded: ({
        address,
        networkId,
      }: {
        address: string;
        networkId: string;
      }) => {
        alert(`address-networkId: ${address}, ${networkId}`);
      },
    });
  }, [navigation]);

  const toEarnRewardPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.EarnReward);
  }, [navigation]);

  const toHardwareSalesRewardPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.HardwareSalesReward);
  }, [navigation]);
  return (
    <YStack px="$5" py="$8" gap="$5">
      <YStack
        bg="$bgSuccessSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSuccessSubdued"
        borderRadius="$3"
        px="$5"
        py="$4"
        gap="$4"
      >
        <XStack ai="center" jc="space-between">
          <SizableText size="$headingMd">
            {intl.formatMessage({
              id: ETranslations.referral_total_reward,
            })}
          </SizableText>
          <NumberSizeableText
            color="$textSuccess"
            formatter="balance"
            size="$bodyLgMedium"
            textDecorationLine="underline"
            textDecorationColor="$textSuccess"
            textDecorationStyle="dotted"
            formatterOptions={{ tokenSymbol: 'USD' }}
          >
            38485.93
          </NumberSizeableText>
        </XStack>
        <YStack gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued" flexShrink={1}>
            {intl.formatMessage({
              id: ETranslations.referral_reward_received_address,
            })}
          </SizableText>
          <XStack ai="center" jc="space-between">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.referral_reward_received_address_notset,
              })}
            </SizableText>
            <IconButton
              title={intl.formatMessage({ id: ETranslations.global_edit })}
              variant="tertiary"
              icon="EditOutline"
              size="small"
              onPress={toEditAddressPage}
              iconColor="$iconSubdued"
            />
          </XStack>
        </YStack>
      </YStack>
      <YStack
        px="$5"
        py="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        onPress={toEarnRewardPage}
      >
        <XStack ai="center" jc="space-between">
          <SizableText size="$headingMd">
            {intl.formatMessage({ id: ETranslations.referral_earn_reward })}
          </SizableText>
          <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
        </XStack>
        <SizableText mt="$0.5" size="$headingMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.referral_earn_reward_desc })}
        </SizableText>
        <YStack gap="$2" pt="$4">
          <XStack gap="$2">
            <Token size="xs" networkId="evm--1" />
            <NumberSizeableText
              formatter="balance"
              size="$bodyMd"
              formatterOptions={{ tokenSymbol: 'USDT' }}
            >
              0.1
            </NumberSizeableText>
          </XStack>
          <Divider bg="$borderSubdued" />
          <XStack gap="$2">
            <Token size="xs" networkId="evm--1" />
            <NumberSizeableText
              formatter="balance"
              size="$bodyMd"
              formatterOptions={{ tokenSymbol: 'ETH' }}
            >
              0.1
            </NumberSizeableText>
          </XStack>
        </YStack>
      </YStack>
      <YStack
        px="$5"
        py="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        onPress={toHardwareSalesRewardPage}
      >
        <XStack ai="center" jc="space-between">
          <SizableText size="$headingMd">
            {intl.formatMessage({ id: ETranslations.referral_sales_reward })}
          </SizableText>
          <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
        </XStack>
        <SizableText mt="$0.5" size="$headingMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.referral_sales_reward_desc })}
        </SizableText>
        <YStack pt="$4">
          <YStack gap="$2">
            <XStack jc="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.referral_sales_level_bronze,
                })}
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {`${intl.formatMessage({
                  id: ETranslations.referral_sales_level_sliver,
                })}(${intl.formatMessage({
                  id: ETranslations.referral_sales_level_upgrade,
                })})`}
              </SizableText>
            </XStack>
            <Progress value={1} width="100%" size="medium" />
          </YStack>
          <XStack pt="$4" gap="$2">
            <Token size="xs" networkId="evm--1" />
            <SizableText size="$bodyMd">
              <NumberSizeableText
                formatter="balance"
                size="$bodyMd"
                formatterOptions={{ tokenSymbol: 'USDC' }}
              >
                0
              </NumberSizeableText>
              {` + `}
              <NumberSizeableText
                formatter="balance"
                size="$bodyMd"
                formatterOptions={{ tokenSymbol: 'USDC' }}
              >
                55.52
              </NumberSizeableText>
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_pending,
              })}
            </SizableText>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}

interface ISolution {
  question: string;
  answer: string;
}

function FAQ({ solutions }: { solutions: ISolution[] }) {
  const intl = useIntl();
  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_faqs })}
      </SizableText>
      <YStack>
        <Accordion type="multiple" gap="$2">
          {solutions.map(({ question, answer }, index) => (
            <Accordion.Item value={String(index)} key={String(index)}>
              <Accordion.Trigger
                unstyled
                flexDirection="row"
                alignItems="center"
                borderWidth={0}
                bg="$transparent"
                px="$2"
                py="$1"
                mx="$-2"
                my="$-1"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                borderRadius="$2"
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size="$bodyLgMedium"
                      color={open ? '$text' : '$textSubdued'}
                    >
                      {question}
                    </SizableText>
                    <Stack animation="quick" rotate={open ? '180deg' : '0deg'}>
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={open ? '$iconActive' : '$iconSubdued'}
                        size="$5"
                      />
                    </Stack>
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.HeightAnimator animation="quick">
                <Accordion.Content
                  unstyled
                  pt="$2"
                  pb="$5"
                  animation="100ms"
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                >
                  <SizableText size="$bodyMd">{answer}</SizableText>
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  );
}

export default function InviteReward() {
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.referral_title,
        })}
      />
      <Page.Body>
        <ShareCode />
        <Dashboard />
        {/* <FAQ /> */}
      </Page.Body>
    </Page>
  );
}
