import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { shouldOpenExpandExtPerp } from '../../../Perp/pages/ExtPerp';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionPerp({
  customization,
  inList,
  onClose,
}: {
  customization?: IActionCustomization;
  inList?: boolean;
  onClose?: () => void;
}) {
  const intl = useIntl();

  const handlePress = useCallback(() => {
    if (customization?.onPress) {
      void customization.onPress();
    } else if (shouldOpenExpandExtPerp()) {
      void backgroundApiProxy.serviceWebviewPerp.openExtPerpTab();
    }
    onClose?.();
  }, [customization, onClose]);

  if (inList) {
    return (
      <ActionList.Item
        trackID="wallet-perp"
        icon={customization?.icon ?? 'TradingViewCandlesOutline'}
        label={
          customization?.label ??
          intl.formatMessage({ id: ETranslations.global_perp })
        }
        onClose={() => {}}
        onPress={handlePress}
      />
    );
  }

  return (
    <RawActions.Perp
      onPress={handlePress}
      label={customization?.label}
      icon={customization?.icon}
      disabled={customization?.disabled}
    />
  );
}

export { WalletActionPerp };
