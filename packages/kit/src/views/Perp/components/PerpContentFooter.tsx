import {
  Icon,
  Page,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { useIntl } from 'react-intl';

import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { NetworkStatusBadge } from '../../../components/NetworkStatusBadge';
import { PerpRefreshButton } from '../../../components/PerpRefreshButton';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const PERP_TELEGRAM_URL = 'https://t.me/OneKeyPerps';

function PerpNetworkStatus() {
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const connected = Boolean(networkStatus?.connected);

  return <NetworkStatusBadge connected={connected} />;
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
          justifyContent="space-between"
        >
          <XStack alignItems="center" gap="$2">
            <PerpNetworkStatus />
            <PerpRefreshButton />
          </XStack>
          <XStack
            alignItems="center"
            gap="$1"
            cursor="pointer"
            hoverStyle={{ opacity: 0.6 }}
            onPress={() => openUrlExternal(PERP_TELEGRAM_URL)}
          >
            <Icon name="TelegramBrand" size="$4" color="$iconSubdued" />
            <SizableText size="$bodySm" color="$textSubdued">
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
