import { useIntl } from 'react-intl';

import { Alert, Button, XStack } from '@onekeyhq/components';
import type { IUiResourceResult } from '@onekeyhq/kit/src/hooks/uiResource';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AccountManagerTestIDs } from '../../../testIDs';

import type { IReplacementWallet } from './useDeprecatedWalletWarning';

export function DeprecatedWalletBanner({
  warning,
  editable,
  interactive,
  onPrimaryPress,
  onRemovePress,
}: {
  warning: IUiResourceResult<IReplacementWallet | null> | undefined;
  editable: boolean;
  interactive: boolean;
  onPrimaryPress: () => Promise<void>;
  onRemovePress: () => void;
}) {
  const intl = useIntl();
  const replacement = warning?.status === 'ready' ? warning.data : undefined;
  const t = (id: ETranslations) =>
    intl.formatMessage({ id }, { name: replacement?.name });
  const copy = replacement
    ? {
        title: t(ETranslations.wallet_device_reset_replaced__title),
        description: t(ETranslations.wallet_device_reset_replaced__desc),
        primary: t(ETranslations.wallet_device_reset_switch__action),
      }
    : {
        title: t(ETranslations.wallet_device_reset__title),
        description: t(ETranslations.wallet_device_reset__desc),
        primary: t(ETranslations.wallet_device_reset_add_device__action),
      };
  const showPrimary =
    warning?.status === 'ready' && (Boolean(replacement) || editable);
  return (
    <Alert
      fullBleed
      type="warning"
      mb="$2"
      title={copy.title}
      description={copy.description}
    >
      {showPrimary || editable ? (
        <XStack pt="$2" columnGap="$5" rowGap="$3" flexWrap="wrap">
          {showPrimary ? (
            <Button
              disabled={!interactive}
              testID={AccountManagerTestIDs.deprecatedWalletPrimaryButton}
              size="small"
              variant="primary"
              maxWidth="100%"
              textEllipsis
              onPress={onPrimaryPress}
            >
              {copy.primary}
            </Button>
          ) : null}
          {editable ? (
            <Button
              disabled={!interactive}
              testID={AccountManagerTestIDs.deprecatedWalletRemoveButton}
              size="small"
              variant="tertiary"
              onPress={onRemovePress}
            >
              {t(ETranslations.global_remove)}
            </Button>
          ) : null}
        </XStack>
      ) : null}
    </Alert>
  );
}
