import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  Icon,
  Popover,
  Switch,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsProviderMirror } from '../PerpsProviderMirror';

import { showPerpFeeTierDialog } from './TradingPanel/components/PerpFeeTierPopover';

interface IPerpSettingsPopoverContentProps {
  closePopover: () => void;
  showFeeTierEntry?: boolean;
}

function PerpSettingsPopoverContent({
  closePopover,
  showFeeTierEntry = false,
}: IPerpSettingsPopoverContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const intl = useIntl();

  return (
    <YStack py="$3" px="$2">
      <ListItem
        mx="$0"
        px="$2.5"
        titleProps={{ size: '$bodyMdMedium' }}
        subtitleProps={{ size: '$bodySm' }}
        title={intl.formatMessage({
          id: ETranslations.perp_setting_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.perp_setting_desc,
        })}
        cursor="default"
      >
        <Switch
          size={ESwitchSize.small}
          value={perpsCustomSettings.skipOrderConfirm}
          onChange={(value) => {
            setPerpsCustomSettings((prev) => ({
              ...prev,
              skipOrderConfirm: value,
            }));
          }}
        />
      </ListItem>

      <ListItem
        mx="$0"
        px="$2.5"
        titleProps={{ size: '$bodyMdMedium' }}
        subtitleProps={{ size: '$bodySm' }}
        title={intl.formatMessage({
          id: ETranslations.perps_settings_shows_buy_sell_title,
        })}
        cursor="default"
      >
        <Switch
          size={ESwitchSize.small}
          value={perpsCustomSettings.showTradeMarks ?? true}
          onChange={(value) => {
            setPerpsCustomSettings((prev) => ({
              ...prev,
              showTradeMarks: value,
            }));
          }}
        />
      </ListItem>

      <ListItem
        mx="$0"
        px="$2.5"
        titleProps={{ size: '$bodyMdMedium' }}
        subtitleProps={{ size: '$bodySm' }}
        title={intl.formatMessage({
          id: ETranslations.perps_settings_shows_positions_title,
        })}
        cursor="default"
      >
        <Switch
          size={ESwitchSize.small}
          value={perpsCustomSettings.showChartLines ?? true}
          onChange={(value) => {
            setPerpsCustomSettings((prev) => ({
              ...prev,
              showChartLines: value,
            }));
          }}
        />
      </ListItem>

      {showFeeTierEntry ? (
        <ListItem
          mx="$0"
          px="$2.5"
          titleProps={{ size: '$bodyMdMedium' }}
          title={intl.formatMessage({
            id: ETranslations.perps_fee_tiers,
          })}
          onPress={() => {
            closePopover();
            showPerpFeeTierDialog();
          }}
          cursor="default"
        >
          <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
        </ListItem>
      ) : null}
    </YStack>
  );
}

export interface IPerpSettingsPopoverProps {
  renderTrigger: ReactNode;
  showFeeTierEntry?: boolean;
}

export function PerpSettingsPopover({
  renderTrigger,
  showFeeTierEntry = false,
}: IPerpSettingsPopoverProps) {
  const intl = useIntl();

  return (
    <PerpsProviderMirror>
      <Popover
        title={intl.formatMessage({
          id: ETranslations.address_book_menu_title,
        })}
        renderTrigger={renderTrigger}
        renderContent={({ closePopover }) => (
          <PerpSettingsPopoverContent
            closePopover={closePopover}
            showFeeTierEntry={showFeeTierEntry}
          />
        )}
        floatingPanelProps={{
          width: 360,
        }}
      />
    </PerpsProviderMirror>
  );
}
