import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

const TransactionLossNetworkFeeExceedDialog = ({
  protocol,
}: {
  protocol: EProtocolOfExchange;
  networkCostExceedInfo: {
    tokenInfo: {
      symbol: string;
      networkId: string;
    };
    cost: string;
    exceedPercent: string;
  };
}) => {
  const intl = useIntl();
  return (
    <YStack gap="$4">
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({
          id:
            protocol === EProtocolOfExchange.LIMIT
              ? ETranslations.limit_network_cost_dialog_content
              : ETranslations.swap_network_cost_dialog_content,
        })}
      </SizableText>
    </YStack>
  );
};

export default TransactionLossNetworkFeeExceedDialog;
