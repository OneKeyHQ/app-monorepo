import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { shouldOpenExpandExtPerp } from '../../../Perp/pages/ExtPerp';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

interface IWalletActionPerpOptions {
  customization?: IActionCustomization;
  inList?: boolean;
  onClose?: () => void;
  showButtonStyle?: boolean;
}

function useWalletActionPerp({
  customization,
  onClose,
}: IWalletActionPerpOptions = {}) {
  const intl = useIntl();

  const handlePress = useCallback(() => {
    if (customization?.onPress) {
      void customization.onPress();
    } else if (shouldOpenExpandExtPerp) {
      void backgroundApiProxy.serviceWebviewPerp.openExtPerpTab();
    }
    onClose?.();
  }, [customization, onClose]);

  return {
    disabled: customization?.disabled ?? false,
    icon: customization?.icon,
    label: intl.formatMessage({
      id: customization?.labelId ?? ETranslations.global_perp,
    }),
    onPress: handlePress,
  };
}

function WalletActionPerp(options: IWalletActionPerpOptions = {}) {
  const { customization, inList, showButtonStyle } = options;
  const action = useWalletActionPerp(options);
  if (inList) {
    return (
      <ActionList.Item
        trackID="wallet-perp"
        icon={customization?.icon ?? 'TradeOutline'}
        label={action.label}
        onClose={() => {}}
        onPress={action.onPress}
      />
    );
  }

  return (
    <RawActions.Perp
      onPress={action.onPress}
      label={action.label}
      icon={action.icon}
      showButtonStyle={showButtonStyle}
      disabled={action.disabled}
    />
  );
}

export { useWalletActionPerp, WalletActionPerp };
