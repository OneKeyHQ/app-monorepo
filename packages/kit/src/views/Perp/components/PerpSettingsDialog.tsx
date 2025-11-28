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

import { useShowInviteeRewardModal } from './InviteeReward/hooks/useShowInviteeRewardModal';

interface IPerpSettingsPopoverContentProps {
  closePopover: () => void;
}

function PerpSettingsPopoverContent({
  closePopover,
}: IPerpSettingsPopoverContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const intl = useIntl();
  const { showInviteeRewardModal } = useShowInviteeRewardModal();

  return (
    <YStack py="$3" px="$4" gap="$3">
      <ListItem
        mx="$0"
        p="$0"
        titleProps={{ size: '$bodyMdMedium' }}
        subtitleProps={{ size: '$bodySm' }}
        title={intl.formatMessage({
          id: ETranslations.perp_setting_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.perp_setting_desc,
        })}
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
        cursor="pointer"
        mx="$0"
        p="$0"
        titleProps={{ size: '$bodyMdMedium' }}
        title={intl.formatMessage({
          id: ETranslations.referral_title,
        })}
        subtitleProps={{ size: '$bodySm' }}
        subtitle={intl.formatMessage({
          id: ETranslations.Perps_referral_bonus_from,
        })}
        onPress={() => {
          closePopover();
          void showInviteeRewardModal();
        }}
        hoverStyle={{}}
        pressStyle={{}}
      >
        <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
      </ListItem>
    </YStack>
  );
}

export interface IPerpSettingsPopoverProps {
  renderTrigger: ReactNode;
}

export function PerpSettingsPopover({
  renderTrigger,
}: IPerpSettingsPopoverProps) {
  const intl = useIntl();

  return (
    <PerpsProviderMirror>
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_settings })}
        renderTrigger={renderTrigger}
        renderContent={({ closePopover }) => (
          <PerpSettingsPopoverContent closePopover={closePopover} />
        )}
        floatingPanelProps={{
          width: 360,
        }}
      />
    </PerpsProviderMirror>
  );
}
