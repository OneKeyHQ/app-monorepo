import { memo, useCallback } from 'react';

import {
  Icon,
  IconButton,
  Popover,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  type IPerpsFooterTickerMode,
  usePerpsFooterTickerModePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const FOOTER_MODES: {
  mode: IPerpsFooterTickerMode;
  label: string;
}[] = [
  { mode: 'none', label: 'No Preview' },
  { mode: 'popular', label: 'Popular' },
  { mode: 'favorites', label: 'Favorites' },
];

function FooterTickerSettingsContent({
  closePopover,
}: {
  closePopover: () => void;
}) {
  const [footerMode, setFooterMode] = usePerpsFooterTickerModePersistAtom();

  const handleSelect = useCallback(
    (mode: IPerpsFooterTickerMode) => {
      setFooterMode({ mode });
      closePopover();
    },
    [setFooterMode, closePopover],
  );

  return (
    <YStack py="$1" minWidth={180}>
      {FOOTER_MODES.map(({ mode, label }) => (
        <ListItem key={mode} onPress={() => handleSelect(mode)} py="$2" px="$3">
          <SizableText size="$bodyMd" flex={1}>
            {label}
          </SizableText>
          {footerMode.mode === mode ? (
            <Icon name="CheckLargeOutline" size="$4.5" color="$icon" />
          ) : null}
        </ListItem>
      ))}
    </YStack>
  );
}

function FooterTickerSettings() {
  return (
    <Popover
      title=""
      placement="top-start"
      renderContent={({ closePopover }) => (
        <FooterTickerSettingsContent closePopover={closePopover} />
      )}
      renderTrigger={
        <IconButton
          icon="SliderVerOutline"
          size="small"
          variant="tertiary"
          iconProps={{ color: '$iconSubdued', size: '$4.5' }}
        />
      }
    />
  );
}

const FooterTickerSettingsMemo = memo(FooterTickerSettings);
export { FooterTickerSettingsMemo as FooterTickerSettings };
