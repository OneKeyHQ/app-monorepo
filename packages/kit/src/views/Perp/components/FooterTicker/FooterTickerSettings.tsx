import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  type IPerpsFooterTickerMode,
  usePerpsFooterTickerModePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const FOOTER_MODES: {
  mode: IPerpsFooterTickerMode;
  labelId: ETranslations;
}[] = [
  { mode: 'none', labelId: ETranslations.perps_no_preview },
  { mode: 'popular', labelId: ETranslations.global_popular },
  { mode: 'favorites', labelId: ETranslations.global_favorites },
];
const FOOTER_SETTINGS_POPOVER_WIDTH = 160;

function FooterTickerSettingsContent({
  closePopover,
}: {
  closePopover: () => void;
}) {
  const intl = useIntl();
  const [footerMode, setFooterMode] = usePerpsFooterTickerModePersistAtom();

  const handleSelect = useCallback(
    (mode: IPerpsFooterTickerMode) => {
      setFooterMode({ mode });
      closePopover();
    },
    [setFooterMode, closePopover],
  );

  return (
    <YStack py="$1">
      {FOOTER_MODES.map(({ mode, labelId }) => (
        <ListItem
          key={mode}
          onPress={() => handleSelect(mode)}
          py="$2"
          px="$3"
          tabIndex={-1}
        >
          <SizableText size="$bodyMd" flex={1}>
            {intl.formatMessage({ id: labelId })}
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
      floatingPanelProps={{
        width: FOOTER_SETTINGS_POPOVER_WIDTH,
      }}
      renderTrigger={
        <Icon
          name="SliderVerOutline"
          size="$4.5"
          color="$iconSubdued"
          cursor="pointer"
          hoverStyle={{ color: '$icon' }}
        />
      }
    />
  );
}

const FooterTickerSettingsMemo = memo(FooterTickerSettings);
export { FooterTickerSettingsMemo as FooterTickerSettings };
