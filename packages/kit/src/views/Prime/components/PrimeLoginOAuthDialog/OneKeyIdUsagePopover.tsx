import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function OneKeyIdUsageItem({
  icon,
  title,
  description,
}: {
  icon: IKeyOfIcons;
  title: string;
  description: string;
}) {
  return (
    <XStack gap="$3" alignItems="flex-start">
      <XStack w="$6" h="$6" alignItems="center" justifyContent="center">
        <Icon name={icon} size="$5" color="$iconSubdued" />
      </XStack>
      <YStack flex={1}>
        <SizableText size="$bodyMdMedium">{title}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {description}
        </SizableText>
      </YStack>
    </XStack>
  );
}

// Explains what OneKey ID is for, opened from the login dialog subtitle link.
// Wide web windows anchor a panel to the link element and also open it on
// hover; native (phones and iPad alike) and narrow web windows always use a
// bottom sheet opened by a press, so nothing depends on measuring the inline
// link on native.
export function OneKeyIdUsagePopover({
  open,
  onOpenChange,
  webAnchorElement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webAnchorElement?: HTMLElement;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const title = intl.formatMessage({
    id: ETranslations.onekey_id_usage__title,
  });
  // The sheet header shows the title; the anchored panel has no header.
  const isAnchoredPanel = !platformEnv.isNative && !md;
  return (
    <Popover
      title={title}
      open={open}
      onOpenChange={onOpenChange}
      renderTrigger={null}
      webAnchorElement={webAnchorElement}
      hoverable
      nativePresentation="sheet"
      placement="bottom-start"
      trackID="onekey-id-usage"
      renderContent={
        <YStack
          testID="onekey-id-usage-content"
          p="$5"
          pt={isAnchoredPanel ? '$5' : '$0'}
          gap="$4"
        >
          {isAnchoredPanel ? (
            <SizableText size="$headingMd">{title}</SizableText>
          ) : null}
          <OneKeyIdUsageItem
            icon="CloudOutline"
            title={intl.formatMessage({ id: ETranslations.keyless_wallet })}
            description={intl.formatMessage({
              id: ETranslations.onekey_id_usage_keyless__desc,
            })}
          />
          <OneKeyIdUsageItem
            icon="PrimeOutline"
            title={intl.formatMessage({ id: ETranslations.global_prime })}
            description={intl.formatMessage({
              id: ETranslations.onekey_id_usage_prime__desc,
            })}
          />
          <OneKeyIdUsageItem
            icon="GiftOutline"
            title={intl.formatMessage({
              id: ETranslations.id_refer_a_friend,
            })}
            description={intl.formatMessage({
              id: ETranslations.onekey_id_usage_referral__desc,
            })}
          />
        </YStack>
      }
    />
  );
}
