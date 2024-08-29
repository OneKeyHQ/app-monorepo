import { useState } from 'react';

import { Input, Popover, Stack, XStack } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';

import { useUrlRiskConfig } from '../../hooks/useUrlRiskConfig';
import { formatHiddenHttpsUrl } from '../../utils/explorerUtils';
import { DappInfoPopoverContent } from '../DappInfoPopoverContent';

function HeaderLeftToolBar({
  url,
  canGoBack,
  canGoForward,
  loading,
  goBack,
  goForward,
  stopLoading,
  reload,
  onSearch,
  isBookmark,
  onBookmarkPress,
  isPinned,
  onPinnedPress,
}: {
  url: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  goBack?: () => void;
  goForward?: () => void;
  stopLoading?: () => void;
  reload?: () => void;
  onSearch?: (url: string) => void;
  isBookmark?: boolean;
  onBookmarkPress?: (bookmark: boolean) => void;
  isPinned?: boolean;
  onPinnedPress?: (pinned: boolean) => void;
}) {
  const { hiddenHttpsUrl } = formatHiddenHttpsUrl(url);
  const { hostSecurity, iconConfig } = useUrlRiskConfig(url);
  const [dappInfoIsOpen, setDappInfoIsOpen] = useState(false);
  const inputProps = {
    onPress: () => {
      onSearch?.(url);
    },
  };
  return (
    <XStack alignItems="center" justifyContent="center" pl="$2">
      <HeaderButtonGroup>
        <HeaderIconButton
          icon="ChevronLeftOutline"
          disabled={!canGoBack}
          onPress={goBack}
          testID="browser-bar-go-back"
        />
        <HeaderIconButton
          icon="ChevronRightOutline"
          disabled={!canGoForward}
          onPress={goForward}
          testID="browser-bar-go-forward"
        />
        <HeaderIconButton
          icon={loading ? 'CrossedLargeOutline' : 'RotateClockwiseOutline'}
          onPress={loading ? stopLoading : reload}
          testID={`action-header-item-${loading ? 'stop-loading' : 'reload'}`}
        />
      </HeaderButtonGroup>
      <Stack>
        <Input
          containerProps={{ ml: '$6', w: '$80' } as any}
          size="small"
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
              testID: `action-header-item-${!isPinned ? 'pin' : 'un-pin'}`,
              ...(isPinned && {
                iconColor: '$icon',
              }),
            },
          ]}
          {...(inputProps as any)}
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
                hostSecurity={hostSecurity}
                closePopover={closePopover}
              />
            )}
          />
        </Stack>
      </Stack>
    </XStack>
  );
}

export default HeaderLeftToolBar;
