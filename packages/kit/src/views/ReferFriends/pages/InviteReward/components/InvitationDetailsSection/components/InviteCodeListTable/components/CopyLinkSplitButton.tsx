import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import {
  REFERRAL_LINK_POPOVER_WIDTH,
  ReferralLinkPopoverContent,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

interface ICopyLinkSplitButtonProps {
  url: string;
}

export function CopyLinkSplitButton({ url }: ICopyLinkSplitButtonProps) {
  const intl = useIntl();
  const { copyUrl } = useClipboard();

  const handleCopy = useCallback(() => {
    void copyUrl(url);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [url, copyUrl]);

  const handleStopPropagation = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
    },
    [],
  );

  const renderTrigger = useMemo(
    () => (
      <Stack
        px="$2"
        py="$1.5"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={() => {}}
      >
        <Icon name="ChevronDownSmallOutline" size="$4" color="$icon" />
      </Stack>
    ),
    [],
  );

  const renderContent = useCallback(
    () => <ReferralLinkPopoverContent inviteUrl={url} />,
    [url],
  );

  return (
    <XStack bg="$bgStrong" borderRadius="$2" overflow="hidden" ai="center">
      <Stack
        px="$2.5"
        py="$1.5"
        onPress={handleCopy}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        cursor="pointer"
      >
        <SizableText size="$bodySm" color="$text">
          {intl.formatMessage({ id: ETranslations.browser_copy_link })}
        </SizableText>
      </Stack>
      <Divider vertical h="$4" />
      <Stack onPress={handleStopPropagation}>
        <Popover
          title={intl.formatMessage({ id: ETranslations.global_more_links })}
          renderTrigger={renderTrigger}
          renderContent={renderContent}
          floatingPanelProps={{
            width: REFERRAL_LINK_POPOVER_WIDTH,
          }}
        />
      </Stack>
    </XStack>
  );
}
