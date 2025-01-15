import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
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
  const PopoverTitle = useMemo(
    () => (
      <XStack gap="$2">
        <HeaderIconButton
          key="allowList"
          titlePlacement="bottom"
          iconProps={{
            color: '$iconSuccess',
          }}
          icon="ShieldCheckDoneSolid"
          testID="setting"
        />
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.allowlist_enabled_popover_title,
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
            color: '$iconSuccess',
          }}
          icon="ShieldCheckDoneOutline"
          testID="setting"
        />
      }
      renderContent={({ closePopover }) => (
        <YStack p="$5" $md={{ pt: 0 }} gap="$2.5">
          {gtMd ? PopoverTitle : null}
          <HyperlinkText
            color="$textSubdued"
            size="$bodyLg"
            translationId={ETranslations.allowlist_enabled_popover_content}
            onAction={closePopover}
          />
        </YStack>
      )}
    />
  );
}

export const renderAddressSecurityHeaderRightButton = () => (
  <AddressSecurityHeaderRightButton />
);
