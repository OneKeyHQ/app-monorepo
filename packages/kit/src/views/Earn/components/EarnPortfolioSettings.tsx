import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  IconButton,
  Popover,
  Switch,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ListItem } from '../../../components/ListItem';
import { useEarnHideSmallAssets } from '../hooks/useEarnHideSmallAssets';

function EarnPortfolioSettingsTriggerComponent({
  hideSmallAssets,
  onHideSmallAssetsChange,
}: {
  hideSmallAssets: boolean;
  onHideSmallAssetsChange: (nextValue: boolean) => void;
}) {
  const intl = useIntl();

  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.defi_display_settings,
      })}
      renderTrigger={
        <IconButton
          testID="earn-handle-tab-press-icon-btn"
          variant="tertiary"
          icon="SliderHorOutline"
          iconSize="$6"
          bg={hideSmallAssets ? '$bgStrong' : 'transparent'}
        />
      }
      renderContent={
        <YStack py="$2.5">
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.defi_hide_low_value_positions,
            })}
            titleProps={{
              size: '$bodyMdMedium',
              color: '$textSubdued',
            }}
            childrenBefore={
              <Switch
                testID="earn-switch"
                size={ESwitchSize.small}
                value={hideSmallAssets}
                onChange={onHideSmallAssetsChange}
              />
            }
          />
        </YStack>
      }
    />
  );
}

export const EarnPortfolioSettingsTrigger = memo(
  EarnPortfolioSettingsTriggerComponent,
);

function EarnPortfolioSettingsComponent() {
  const { hideSmallAssets, setHideSmallAssets } = useEarnHideSmallAssets();

  return (
    <EarnPortfolioSettingsTrigger
      hideSmallAssets={hideSmallAssets}
      onHideSmallAssetsChange={setHideSmallAssets}
    />
  );
}

export const EarnPortfolioSettings = memo(EarnPortfolioSettingsComponent);
