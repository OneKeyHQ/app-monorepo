import { IconButton, Popover, SizableText, YStack } from '@onekeyhq/components';

export function ReferralInfoButton({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Popover
      title={title}
      hoverable
      placement="bottom-start"
      floatingPanelProps={{ width: 320 }}
      renderTrigger={
        <IconButton
          testID="referral-info-button"
          icon="InfoCircleOutline"
          variant="tertiary"
          size="small"
          iconProps={{ color: '$iconSubdued', size: '$4' }}
          accessibilityLabel={title}
        />
      }
      renderContent={
        <YStack p="$4">
          <SizableText size="$bodyMd">{description}</SizableText>
        </YStack>
      }
    />
  );
}
