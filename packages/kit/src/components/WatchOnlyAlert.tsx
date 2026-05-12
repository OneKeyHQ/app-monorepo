import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Stack } from '@onekeyhq/components';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useActiveAccount } from '../states/jotai/contexts/accountSelector';

function BasicWatchOnlyAlert() {
  const intl = useIntl();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });

  if (wallet?.type !== WALLET_TYPE_WATCHING) {
    return null;
  }

  return (
    <Stack pt="$2" px="$pagePadding" bg="$bgApp">
      <Alert
        type="warning"
        icon="ErrorOutline"
        title={intl.formatMessage({
          id: ETranslations.watch_only_alert_do_not_send,
        })}
      />
    </Stack>
  );
}

export const WatchOnlyAlert = memo(BasicWatchOnlyAlert);
