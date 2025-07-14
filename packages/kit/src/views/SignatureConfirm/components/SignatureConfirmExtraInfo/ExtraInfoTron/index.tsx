import { memo, useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type {
  IDialogInstance,
  IStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import { Icon, XStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { showResourceDetailsDialog } from '@onekeyhq/kit/src/components/Resource';
import {
  useSendSelectedFeeInfoAtom,
  useTronResourceRentalInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

import ClaimResourceEntry from './ClaimResourceEntry';
import ResourceRental from './ResourceRental';

function ExtraInfoTron({
  accountId,
  networkId,
  unsignedTxs,
  style,
}: {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
  style?: IStackProps;
}) {
  const intl = useIntl();
  const [selectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [resourceRentalInfo] = useTronResourceRentalInfoAtom();

  const feeTron = selectedFeeInfo?.feeInfos?.[0]?.feeInfo?.feeTron;

  const resourceDialogInstance = useRef<IDialogInstance | null>(null);

  const handleResourceDetailsOnPress = useCallback(() => {
    if (resourceDialogInstance?.current) {
      return;
    }
    resourceDialogInstance.current = showResourceDetailsDialog({
      accountId,
      networkId,
      onClose: () => {
        resourceDialogInstance.current = null;
      },
    });
  }, [accountId, networkId]);

  if (!feeTron) return null;

  if (unsignedTxs.length > 1) {
    return null;
  }

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
      <XStack alignItems="center" justifyContent="space-between">
        <XStack
          {...listItemPressStyle}
          alignSelf="flex-start"
          gap="$1.5"
          px="$1"
          mx="$-1"
          alignItems="center"
          userSelect="none"
          borderRadius="$1"
          focusable
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineOffset: 0,
          }}
          onPress={handleResourceDetailsOnPress}
        >
          <SignatureConfirmItem.Label>
            {intl.formatMessage({ id: ETranslations.global_resources })}
          </SignatureConfirmItem.Label>
          <Icon name="InfoCircleOutline" size="$4.5" color="$iconSubdued" />
        </XStack>
        {resourceRentalInfo.isResourceRentalNeeded ? (
          <ClaimResourceEntry accountId={accountId} networkId={networkId} />
        ) : null}
      </XStack>
      <SignatureConfirmItem.Value>
        {intl.formatMessage(
          {
            id: ETranslations.global_energy_bandwidth_num,
          },
          {
            num_1: feeTron.requiredEnergy ?? '0',
            num_2: feeTron.requiredBandwidth ?? '0',
          },
        )}
      </SignatureConfirmItem.Value>
      <ResourceRental />
    </SignatureConfirmItem>
  );
}

export default memo(ExtraInfoTron);
