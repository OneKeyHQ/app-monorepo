import {
  Button,
  Icon,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

export default function InviteReward() {
  return (
    <Page>
      <Page.Header title="Invite & Reward" />
      <Page.Body>
        <YStack px="$5">
          <XStack jc="space-between">
            <SizableText size="$headingMd">Your referral code</SizableText>
            <Button
              //   childrenAsText={!hasClaimableAssets}
              //   onPress={onPress}
              variant="tertiary"
              iconAfter="ChevronRightOutline"
              jc="center"
            >
              Referred
            </Button>
          </XStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}
