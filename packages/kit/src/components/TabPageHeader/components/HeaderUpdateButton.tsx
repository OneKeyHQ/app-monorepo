import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '@onekeyhq/kit/src/components/AppUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Desktop top-right "Update" button. Surfaces under the exact same conditions
// as the toolbox update dot (isShowAppUpdateUIWhenUpdating: seamless=never,
// manual/force=always, silent=only at ready) and shares the unified
// onUpdateActionDirect click logic (hot update → restart, major version →
// download/verify modal, skipping the changelog).
function BasicHeaderUpdateButton() {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo(true);
  const { data, isNeedUpdate, onUpdateActionDirect } = appUpdateInfo;

  const showUpdate = useMemo(
    () =>
      isNeedUpdate &&
      isShowAppUpdateUIWhenUpdating({
        updateStrategy: data.updateStrategy,
        updateStatus: data.status,
      }),
    [isNeedUpdate, data.updateStrategy, data.status],
  );

  if (!showUpdate) {
    return null;
  }

  return (
    <Button
      testID="header-update-button"
      size="small"
      // Right gap so the button doesn't sit flush against the notification
      // bell. Self-contained (rather than parent spacing) so it disappears
      // with the button when there's no update.
      mr="$3"
      onPress={onUpdateActionDirect}
      bg="$bgInfoStrong"
      color="$textOnColor"
      hoverStyle={{
        bg: '$info10',
      }}
      pressStyle={{
        bg: '$info11',
      }}
    >
      {intl.formatMessage({ id: ETranslations.update_update_now })}
    </Button>
  );
}

export const HeaderUpdateButton = platformEnv.isDesktop
  ? BasicHeaderUpdateButton
  : () => null;
