import { useMemo } from 'react';
import { useIntl } from 'react-intl';

import {
  Icon,
  Page,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { NetworkStatusBadge } from '../../../components/NetworkStatusBadge';
import { PerpRefreshButton } from '../../../components/PerpRefreshButton';

import { PerpFooterTicker } from './FooterTicker/PerpFooterTicker';

const PERP_TELEGRAM_URL = 'https://t.me/OneKeyPerps';

function PerpNetworkStatus() {
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const connected = Boolean(networkStatus?.connected);
  const pingMs = networkStatus?.pingMs;
  const intl = useIntl();

  const label = useMemo(() => {
    if (connected && pingMs !== null && pingMs !== undefined) {
      return `${intl.formatMessage({ id: ETranslations.perp_online })} ${pingMs}ms`;
    }
    return undefined;
  }, [connected, pingMs, intl]);

  return <NetworkStatusBadge connected={connected} label={label} />;
}

export function PerpContentFooter() {
  const { gtSm } = useMedia();
  const intl = useIntl();

  if (!platformEnv.isNative && !platformEnv.isWebDappMode && gtSm) {
    return (
      <Page.Footer>
        <XStack
          borderTopWidth="$px"
          borderTopColor="$borderSubdued"
          bg="$bgApp"
          h={40}
          alignItems="center"
          p="$2"
          gap="$2"
        >
          <XStack alignItems="center" gap="$2" flexShrink={0}>
            <PerpNetworkStatus />
            <PerpRefreshButton />
          </XStack>
          <PerpFooterTicker />
          <XStack
            alignItems="center"
            gap="$1"
            cursor="pointer"
            flexShrink={0}
            hoverStyle={{ opacity: 0.6 }}
            onPress={() => openUrlExternal(PERP_TELEGRAM_URL)}
          >
            <Icon name="TelegramBrand" size="$4" color="$iconSubdued" />
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perps_footer_help_us_better,
              })}
            </SizableText>
          </XStack>
        </XStack>
      </Page.Footer>
    );
  }
}
