import type { PropsWithChildren } from 'react';
import { Fragment, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { Share, StyleSheet } from 'react-native';

import {
  Accordion,
  Badge,
  Button,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  Page,
  Popover,
  Progress,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { referralLink } from '@onekeyhq/shared/src/utils/referralUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function PopoverLine({ children }: PropsWithChildren) {
  return (
    <XStack gap="$3" ai="center">
      <Stack w="$1.5" h="$1.5" bg="$textSubdued" borderRadius="$full" />
      <SizableText size="$bodyMd">{children}</SizableText>
    </XStack>
  );
}

function NoRewardYet() {
  const intl = useIntl();
  return (
    <XStack pt="$4" gap="$2.5" ai="center">
      <XStack>
        <Icon size="$4" name="GiftOutline" color="$iconSubdued" />
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.referral_no_reward })}
      </SizableText>
    </XStack>
  );
}

function ShareCode({
  inviteUrl,
  inviteCode,
}: {
  inviteUrl: string;
  inviteCode: string;
}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { copyText } = useClipboard();

  const handleCopy = useCallback(() => {
    copyText(inviteCode);
  }, [copyText, inviteCode]);

  const inviteCodeUrl = useMemo(() => {
    return inviteUrl.replace('https://', '');
  }, [inviteUrl]);

  const toYourReferredPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.YourReferred);
  }, [navigation]);
  const intl = useIntl();
  const sharedUrl = useMemo(() => `https://${inviteCodeUrl}`, [inviteCodeUrl]);
  return (
    <>
      <YStack px="$5" pt="$6" pb="$5" $platform-native={{ pb: '$8' }}>
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
            <SizableText size="$heading4xl">{inviteCode}</SizableText>
            <IconButton
              title={intl.formatMessage({ id: ETranslations.global_copy })}
              variant="tertiary"
              icon="Copy3Outline"
              size="large"
              iconColor="$iconSubdued"
              onPress={handleCopy}
            />
          </XStack>
          <Stack
            mt="$2.5"
            ai="center"
            gap="$2.5"
            flexDirection="row"
            $platform-native={{
              flexDirection: 'column',
              gap: '$4',
            }}
          >
            <XStack
              borderColor="rgba(0, 0, 0, 0.13)"
              bg="$bgDisabled"
              px="$3"
              py="$1.5"
              flex={1}
              width="100%"
              borderWidth={StyleSheet.hairlineWidth}
              jc="space-between"
              ai="center"
              borderRadius="$2.5"
            >
              <SizableText size="$bodyLg" flexShrink={1}>
                {inviteCodeUrl}
              </SizableText>
              {platformEnv.isNative ? null : (
                <IconButton
                  title={intl.formatMessage({ id: ETranslations.global_copy })}
                  icon="Copy3Outline"
                  variant="tertiary"
                  size="medium"
                  iconColor="$iconSubdued"
                  onPress={() => {
                    copyText(sharedUrl);
                  }}
                />
              )}
            </XStack>
            {platformEnv.isNative ? (
              <XStack
                ai="center"
                gap="$2.5"
                $md={{
                  width: '100%',
                }}
              >
                <Button
                  icon="Copy3Outline"
                  variant={platformEnv.isNative ? undefined : 'primary'}
                  $md={{
                    flex: 1,
                  }}
                  size={gtMd ? 'medium' : 'large'}
                  onPress={() => {
                    copyText(sharedUrl);
                  }}
                >
                  {intl.formatMessage({ id: ETranslations.global_copy })}
                </Button>
                <Button
                  variant="primary"
                  icon="ShareOutline"
                  size={gtMd ? 'medium' : 'large'}
                  $md={{
                    flex: 1,
                  }}
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
                >
                  {intl.formatMessage({ id: ETranslations.explore_share })}
                </Button>
              </XStack>
            ) : null}
          </Stack>
        </YStack>
      </YStack>
      <Divider mx="$5" />
    </>
  );
}

function Dashboard({
  totalRewards,
  enabledNetworks,
  hardwareSales,
  earn,
  levelPercent,
  rebateLevel,
  nextRebateLevel,
  fetchSummaryInfo,
  withdrawAddresses,
}: {
  totalRewards: string;
  enabledNetworks: IInviteSummary['enabledNetworks'];
  earn: IInviteSummary['Earn'];
  hardwareSales: IInviteSummary['HardwareSales'];
  withdrawAddresses: IInviteSummary['withdrawAddresses'];
  levelPercent: number;
  rebateLevel: string;
  nextRebateLevel: string;
  fetchSummaryInfo: () => void;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const toEditAddressPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.EditAddress, {
      enabledNetworks,
      accountId: activeAccount.account?.id ?? '',
      onAddressAdded: async () => {
        setTimeout(() => {
          fetchSummaryInfo();
        }, 50);
      },
    });
  }, [
    activeAccount.account?.id,
    enabledNetworks,
    fetchSummaryInfo,
    navigation,
  ]);

  const toEarnRewardPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.EarnReward);
  }, [navigation]);

  const toHardwareSalesRewardPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.HardwareSalesReward);
  }, [navigation]);

  const showEarnSalesAvailableFiat = (earn.available?.length || 0) > 0;
  const showHardwareSalesAvailableFiat =
    (hardwareSales.available?.length || 0) > 0;
  const showHardwarePendingFiat = (hardwareSales.pending?.length || 0) > 0;
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
          <Popover
            title={intl.formatMessage({
              id: ETranslations.referral_total_reward,
            })}
            renderTrigger={
              <NumberSizeableText
                pb={1}
                color="$textSuccess"
                formatter="value"
                size="$bodyLgMedium"
                cursor="pointer"
                textDecorationLine="underline"
                textDecorationColor="$textSuccess"
                textDecorationStyle="dotted"
                formatterOptions={{ tokenSymbol: 'USD' }}
                style={{
                  textUnderlineOffset: 4,
                }}
              >
                {totalRewards}
              </NumberSizeableText>
            }
            renderContent={
              <Stack gap="$2.5" p="$5">
                <PopoverLine>
                  {intl.formatMessage({
                    id: ETranslations.referral_total_reward_pop1,
                  })}
                </PopoverLine>
                <PopoverLine>
                  {intl.formatMessage({
                    id: ETranslations.referral_total_reward_pop2,
                  })}
                </PopoverLine>
              </Stack>
            }
          />
        </XStack>
        <YStack gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.referral_reward_received_address,
            })}
          </SizableText>
          <XStack ai="center" jc="space-between" gap="$5">
            <XStack flexShrink={1}>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                flexShrink={1}
                numberOfLines={10}
              >
                {withdrawAddresses.length
                  ? withdrawAddresses[0].address
                  : intl.formatMessage({
                      id: ETranslations.referral_reward_received_address_notset,
                    })}
              </SizableText>
            </XStack>
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
        onPress={toHardwareSalesRewardPage}
      >
        <XStack ai="center" jc="space-between">
          <SizableText size="$headingMd">
            {intl.formatMessage({ id: ETranslations.referral_sales_reward })}
          </SizableText>
          <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
        </XStack>
        <SizableText mt="$0.5" size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.referral_sales_reward_desc })}
        </SizableText>
        <YStack pt="$4">
          <YStack gap="$2">
            <XStack jc="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {rebateLevel}
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {nextRebateLevel}
              </SizableText>
            </XStack>
            <Progress value={levelPercent} width="100%" size="medium" />
          </YStack>
          {showHardwareSalesAvailableFiat || showHardwarePendingFiat ? (
            <XStack pt="$4" gap="$2">
              {hardwareSales.available?.[0]?.token?.networkId ? (
                <Token
                  size="xs"
                  tokenImageUri={hardwareSales.available?.[0].token.logoURI}
                />
              ) : null}
              <SizableText size="$bodyMd">
                <NumberSizeableText
                  formatter="balance"
                  size="$bodyMd"
                  formatterOptions={{
                    tokenSymbol: hardwareSales.available?.[0]?.token?.symbol,
                  }}
                >
                  {hardwareSales.available?.[0]?.fiatValue || 0}
                </NumberSizeableText>
                {showHardwarePendingFiat ? (
                  <>
                    <SizableText size="$bodyMd">{` + `}</SizableText>
                    <NumberSizeableText
                      formatter="balance"
                      size="$bodyMd"
                      formatterOptions={{
                        tokenSymbol: hardwareSales.pending?.[0]?.token.symbol,
                      }}
                    >
                      {hardwareSales.pending?.[0]?.fiatValue || 0}
                    </NumberSizeableText>
                  </>
                ) : null}
              </SizableText>
              {showHardwarePendingFiat ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_sales_reward_pending,
                  })}
                </SizableText>
              ) : null}
            </XStack>
          ) : (
            <NoRewardYet />
          )}
        </YStack>
      </YStack>
      <YStack
        px="$5"
        py="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        // onPress={toEarnRewardPage}
      >
        <XStack ai="center" jc="space-between">
          <XStack ai="flex-end">
            <SizableText size="$headingMd">
              {intl.formatMessage({ id: ETranslations.referral_earn_reward })}
            </SizableText>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              position="relative"
              top={-2}
            >
              {`  (${intl.formatMessage({
                id: ETranslations.coming_soon,
              })})`}
            </SizableText>
          </XStack>
          {/* <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" /> */}
        </XStack>
        <SizableText mt="$0.5" size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.referral_earn_reward_desc })}
        </SizableText>
        {showEarnSalesAvailableFiat ? (
          <YStack gap="$2" pt="$4">
            {earn.available?.map(({ token, fiatValue }, index) => {
              return (
                <Fragment key={index}>
                  <XStack gap="$2" py={5}>
                    <Token size="xs" tokenImageUri={token.logoURI} />
                    <NumberSizeableText
                      formatter="balance"
                      size="$bodyMd"
                      formatterOptions={{
                        tokenSymbol: token.symbol,
                      }}
                    >
                      {fiatValue}
                    </NumberSizeableText>
                  </XStack>
                  {index !== (earn.available?.length || 1) - 1 ? (
                    <Divider bg="$borderSubdued" />
                  ) : null}
                </Fragment>
              );
            })}
          </YStack>
        ) : (
          <NoRewardYet />
        )}
      </YStack>
      <YStack
        px="$5"
        py="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        <XStack ai="center" jc="space-between">
          <XStack ai="flex-end">
            <SizableText size="$headingMd">
              {intl.formatMessage({ id: ETranslations.referral_swap_reward })}
            </SizableText>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              position="relative"
              top={-2}
            >
              {`  (${intl.formatMessage({
                id: ETranslations.coming_soon,
              })})`}
            </SizableText>
          </XStack>
        </XStack>
        <SizableText mt="$0.5" size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.referral_swap_reward_desc })}
        </SizableText>
        <NoRewardYet />
      </YStack>
    </YStack>
  );
}

function FAQ({ faqs }: { faqs: IInviteSummary['faqs'] }) {
  const intl = useIntl();
  return (
    <YStack gap="$6" px="$5" py="$8">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_faqs })}
      </SizableText>
      <YStack>
        <Accordion type="multiple" gap="$2">
          {faqs.map(({ q, a }, index) => (
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
                      {q}
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
                  <SizableText size="$bodyMd">{a}</SizableText>
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  );
}

function Link() {
  const intl = useIntl();

  return (
    <SizableText
      color="$textInfo"
      cursor="pointer"
      size="$bodyMdMedium"
      px="$5"
      mb="$5"
      textDecorationLine="underline"
      onPress={() => openUrlExternal(referralLink)}
    >
      {intl.formatMessage({ id: ETranslations.referral_more_questions })}
    </SizableText>
  );
}

function InviteRewardContent({
  summaryInfo,
  fetchSummaryInfo,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => void;
}) {
  const {
    faqs,
    inviteUrl,
    inviteCode,
    totalRewards,
    enabledNetworks,
    Earn,
    HardwareSales,
    levelPercent,
    rebateLevel,
    nextRebateLevel,
    withdrawAddresses,
  } = summaryInfo;
  return (
    <>
      <ShareCode inviteUrl={inviteUrl} inviteCode={inviteCode} />
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
        }}
        enabledNum={[0]}
      >
        <Dashboard
          totalRewards={totalRewards}
          enabledNetworks={enabledNetworks}
          earn={Earn}
          hardwareSales={HardwareSales}
          levelPercent={Number(levelPercent)}
          rebateLevel={rebateLevel}
          nextRebateLevel={nextRebateLevel}
          fetchSummaryInfo={fetchSummaryInfo}
          withdrawAddresses={withdrawAddresses}
        />
      </AccountSelectorProviderMirror>

      <FAQ faqs={faqs} />
      <Link />
    </>
  );
}

export default function InviteReward() {
  const intl = useIntl();
  const { result: summaryInfo, run: fetchSummaryInfo } = usePromiseResult(
    async () => backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
    [],
    {
      initResult: undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const renderHeaderTitle = useCallback(
    () => (
      <XStack gap="$2">
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.referral_title,
          })}
        </SizableText>
        <Badge badgeType="info" badgeSize="sm">
          <Badge.Text>Beta</Badge.Text>
        </Badge>
      </XStack>
    ),
    [intl],
  );

  return (
    <Page>
      <Page.Header headerTitle={renderHeaderTitle} />
      <Page.Body>
        {!summaryInfo ? (
          <Stack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            ai="center"
            jc="center"
            flex={1}
          >
            <Spinner size="large" />
          </Stack>
        ) : (
          <ScrollView>
            <InviteRewardContent
              summaryInfo={summaryInfo}
              fetchSummaryInfo={fetchSummaryInfo}
            />
          </ScrollView>
        )}
      </Page.Body>
    </Page>
  );
}
