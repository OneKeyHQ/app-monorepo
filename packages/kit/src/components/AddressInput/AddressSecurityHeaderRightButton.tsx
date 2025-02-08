import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  HeaderIconButton,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IHyperlinkTextProps } from '@onekeyhq/kit/src/components/HyperlinkText';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HyperlinkText } from '../HyperlinkText';

import { useIsEnableTransferAllowList } from './hooks';

export function TransferAllowListContent({
  onAction,
}: {
  onAction?: IHyperlinkTextProps['onAction'];
}) {
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const intl = useIntl();
  return (
    <YStack gap="$1.5" flexShrink={1}>
      <XStack flexShrink={1}>
        <Badge
          flexShrink={1}
          badgeSize="lg"
          badgeType={isEnableTransferAllowList ? 'success' : 'default'}
        >
          <Badge.Text>
            {intl.formatMessage({
              id: isEnableTransferAllowList
                ? ETranslations.global_enabled
                : ETranslations.global_disabled,
            })}
          </Badge.Text>
        </Badge>
      </XStack>
      <HyperlinkText
        flexShrink={1}
        color="$textSubdued"
        size="$bodyMd"
        translationId={ETranslations.allowlist_enabled_popover_content}
        onAction={onAction}
      />
    </YStack>
  );
}

function AddressSecurityHeaderRightButton() {
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const { gtMd } = useMedia();
  const intl = useIntl();
  const { icon, iconColor } = useMemo(() => {
    if (isEnableTransferAllowList) {
      return {
        icon: 'ShieldCheckDoneSolid',
        iconColor: '$iconSuccess',
      };
    }
    return {
      icon: 'ShieldOutline',
      iconColor: '$iconSubdued',
    };
  }, [isEnableTransferAllowList]);

  const PopoverTitle = useMemo(
    () => (
      <XStack gap="$2">
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.settings_protection_allowlist_title,
          })}
        </SizableText>
      </XStack>
    ),
    [intl],
  );
  return (
    <Popover
      title={PopoverTitle}
      renderTrigger={
        <HeaderIconButton
          key="allowList"
          titlePlacement="bottom"
          iconProps={{
            color: iconColor as ColorTokens,
          }}
          icon={icon as IKeyOfIcons}
          testID="setting"
        />
      }
      renderContent={({ closePopover }) => (
        <YStack p="$5" $md={{ pt: 0 }} gap="$2.5">
          {gtMd ? PopoverTitle : null}
          <TransferAllowListContent onAction={closePopover} />
        </YStack>
      )}
    />
  );
}

export const renderAddressSecurityHeaderRightButton = () => (
  <AddressSecurityHeaderRightButton />
);
