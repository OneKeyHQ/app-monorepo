import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeType } from '@onekeyhq/components';
import { Badge, ListItem, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getFeeConfidenceLevelStyle } from '@onekeyhq/kit/src/utils/gasFee';
import type { IGasEIP1559Prediction } from '@onekeyhq/shared/types/gas';

type IProps = {
  networkId: string;
  onSelected: (feePrediction: IGasEIP1559Prediction) => void;
};

function FeePredictionContainer(props: IProps) {
  const { networkId, onSelected } = props;
  const intl = useIntl();

  const { prediction } =
    usePromiseResult(async () => {
      const r = await backgroundApiProxy.serviceGas.estimateGasFee({
        networkId,
      });
      return r;
    }, [networkId]).result ?? {};

  const renderPrediction = useCallback(
    (item: IGasEIP1559Prediction, index: number) => {
      const title = `${intl.formatMessage({ id: 'form__priority_fee' })}: ${
        item.maxPriorityFeePerGas
      }`;

      const subtitle = `${intl.formatMessage({ id: 'form__max_fee' })}: ${
        item.maxFeePerGas
      }`;

      const { badgeType } = getFeeConfidenceLevelStyle(item.confidence);
      return (
        <ListItem
          key={index}
          title={title}
          subtitle={subtitle}
          onPress={() => onSelected(item)}
        >
          <Badge badgeType={badgeType as IBadgeType} badgeSize="lg">
            {intl.formatMessage(
              { id: 'form__str_probability' },
              { 0: `${item.confidence}%` },
            )}
          </Badge>
        </ListItem>
      );
    },
    [intl, onSelected],
  );

  if (!prediction || prediction.length === 0) return null;

  return (
    <YStack space="$4" px="$5" py="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        Gas Fee Prediction
      </SizableText>
      <YStack>{prediction.map(renderPrediction)}</YStack>
    </YStack>
  );
}

export { FeePredictionContainer };
