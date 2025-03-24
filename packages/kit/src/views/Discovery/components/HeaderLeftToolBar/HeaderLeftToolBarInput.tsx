import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens, Icon } from '@onekeyhq/components';
import { Input, Popover, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { DappInfoPopoverContent } from '../DappInfoPopoverContent';

interface IHeaderLeftToolBarInputProps {
  iconConfig: {
    iconName: NonNullable<Parameters<typeof Icon>[0]['name']>;
    iconColor: ColorTokens;
  };
  hiddenHttpsUrl: string;
  isBookmark?: boolean;
  isPinned?: boolean;
  onBookmarkPress?: (bookmark: boolean) => void;
  onPinnedPress?: (pinned: boolean) => void;
  inputProps?: {
    onPress?: () => void;
  };
  hostSecurity: any;
}

function HeaderLeftToolBarInput({
  iconConfig,
  hiddenHttpsUrl,
  isBookmark,
  isPinned,
  onBookmarkPress,
  onPinnedPress,
  inputProps,
  hostSecurity,
}: IHeaderLeftToolBarInputProps) {
  const intl = useIntl();
  const [dappInfoIsOpen, setDappInfoIsOpen] = useState(false);

  return (
    <Stack flex={1}>
      <Input
        containerProps={{ mx: '$6', flex: 1 } as any}
        size="small"
        bg="$red10"
        leftAddOnProps={{
          ...iconConfig,
          iconSize: '$4',
          mr: '$-2',
          onPress: () => {
            setDappInfoIsOpen(true);
          },
        }}
        pb="$1.5"
        value={hiddenHttpsUrl}
        selectTextOnFocus
        testID="explore-index-search-input"
        addOns={[
          {
            iconName: isBookmark ? 'StarSolid' : 'StarOutline',
            onPress: () => onBookmarkPress?.(!isBookmark),
            tooltipProps: {
              shortcutKey: EShortcutEvents.AddOrRemoveBookmark,
              renderContent: intl.formatMessage({
                id: isBookmark
                  ? ETranslations.explore_remove_bookmark
                  : ETranslations.explore_add_bookmark,
              }),
            },
            testID: `action-header-item-${
              !isBookmark ? 'bookmark' : 'remove-bookmark'
            }`,
            ...(isBookmark && {
              iconColor: '$icon',
            }),
          },
          {
            iconName: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
            onPress: () => onPinnedPress?.(!isPinned),
            tooltipProps: {
              shortcutKey: EShortcutEvents.PinOrUnpinTab,
              renderContent: intl.formatMessage({
                id: isPinned
                  ? ETranslations.explore_unpin
                  : ETranslations.explore_pin,
              }),
            },
            testID: `action-header-item-${!isPinned ? 'pin' : 'un-pin'}`,
            ...(isPinned && {
              iconColor: '$icon',
            }),
          },
        ]}
        {...inputProps}
      />
      <Stack ml={24}>
        <Popover
          placement="bottom-start"
          title="dApp info"
          open={dappInfoIsOpen}
          onOpenChange={setDappInfoIsOpen}
          renderTrigger={<Stack />}
          renderContent={({ closePopover }) => (
            <DappInfoPopoverContent
              iconConfig={iconConfig}
              hostSecurity={hostSecurity}
              closePopover={closePopover}
            />
          )}
        />
      </Stack>
    </Stack>
  );
}

export default HeaderLeftToolBarInput;
