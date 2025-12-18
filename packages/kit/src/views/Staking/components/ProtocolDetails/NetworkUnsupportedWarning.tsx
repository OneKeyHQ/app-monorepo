import { useIntl } from 'react-intl';

import { Alert, Empty } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function NetworkUnsupportedWarning({
  networkId,
  emptyStyle = false,
}: {
  networkId: string;
  emptyStyle?: boolean;
}) {
  const intl = useIntl();

  const { result } = usePromiseResult(async () => {
    const { serviceNetwork } = backgroundApiProxy;
    const network = await serviceNetwork.getNetwork({ networkId });
    return {
      networkName: network.name,
    };
  }, [networkId]);

  return emptyStyle ? (
    <Empty
      icon="GlobusOutline"
      title={intl.formatMessage(
        { id: ETranslations.wallet_unsupported_network_title },
        { network: result?.networkName ?? '' },
      )}
    />
  ) : (
    <Alert
      type="warning"
      title={intl.formatMessage(
        { id: ETranslations.wallet_unsupported_network_title },
        { network: result?.networkName ?? '' },
      )}
      description={intl.formatMessage({
        id: ETranslations.wallet_unsupported_network_desc,
      })}
      action={undefined}
    />
  );
}
