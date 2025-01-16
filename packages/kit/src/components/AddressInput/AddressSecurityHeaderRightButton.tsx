import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  HeaderIconButton,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HyperlinkText } from '../HyperlinkText';

function AddressSecurityHeaderRightButton() {
  const [settings] = useSettingsPersistAtom();
  const isEnableTransferAllowList = useMemo(
    () => settings.transferAllowList ?? true,
    [settings.transferAllowList],
  );
  const { gtMd } = useMedia();
  const intl = useIntl();
  const iconProps = useMemo(
    () =>
      isEnableTransferAllowList
        ? ({
            name: 'ShieldCheckDoneOutline',
            color: '$iconSuccess',
          } as const)
        : ({
            name: 'ShieldKeyholeOutline',
            color: '$icon',
          } as const),
    [isEnableTransferAllowList],
  );
  const PopoverTitle = useMemo(
    () => (
      <XStack gap="$2">
        <HeaderIconButton
          key="allowList"
          titlePlacement="bottom"
          iconProps={{
            color: iconProps.color,
          }}
          icon={iconProps.name}
          testID="setting"
        />
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.allowlist_enabled_popover_title,
          })}
        </SizableText>
      </XStack>
    ),
    [iconProps.color, iconProps.name, intl],
  );
  return (
    <Popover
      title={PopoverTitle}
      renderTrigger={
        <HeaderIconButton
          key="allowList"
          titlePlacement="bottom"
          iconProps={{
            color: iconProps.color,
          }}
          icon={iconProps.name}
          testID="setting"
        />
      }
      renderContent={({ closePopover }) => (
        <YStack p="$5" $md={{ pt: 0 }} gap="$2.5">
          {gtMd ? PopoverTitle : null}
          <YStack gap="$1.5">
            <XStack>
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
              color="$textSubdued"
              size="$bodyLg"
              translationId={ETranslations.allowlist_enabled_popover_content}
              onAction={closePopover}
            />
          </YStack>
        </YStack>
      )}
    />
  );
}

export const renderAddressSecurityHeaderRightButton = () => (
  <AddressSecurityHeaderRightButton />
);
