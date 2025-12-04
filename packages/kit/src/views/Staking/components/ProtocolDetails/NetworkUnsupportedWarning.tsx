import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function NetworkUnsupportedWarning({
  networkId,
}: {
  networkId: string;
}) {
  const intl = useIntl();

  const { result } = usePromiseResult(async () => {
    const { serviceNetwork } = backgroundApiProxy;
    const network = await serviceNetwork.getNetwork({ networkId });
    return {
      networkName: network.name,
    };
  }, [networkId]);

  return (
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
