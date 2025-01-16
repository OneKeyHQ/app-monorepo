import type { ReactElement } from 'react';
import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeProps } from '@onekeyhq/components';
import { Badge, Popover, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAddressInteractionStatus } from '@onekeyhq/shared/types/address';

interface IBasicAddressBadgeProps {
  title: string;
  content: ReactElement | string;
  badgeType: IBadgeProps['badgeType'];
}

function BasicAddressBadge({
  title,
  content,
  badgeType,
}: IBasicAddressBadgeProps) {
  return (
    <Popover
      placement="bottom-start"
      title={title}
      renderTrigger={
        <Badge badgeType={badgeType} badgeSize="sm">
          {title}
        </Badge>
      }
      renderContent={() => (
        <Stack gap="$4" p="$4">
          <SizableText size="$bodyMd">{content}</SizableText>
        </Stack>
      )}
    />
  );
}

export interface IAddressBadgeProps {
  status?: EAddressInteractionStatus;
  networkId?: string;
  isContract?: boolean;
}

function AddressBadgeFrame({
  status,
  networkId,
  isContract,
}: IAddressBadgeProps) {
  const intl = useIntl();
  const { result } = usePromiseResult(
    () =>
      networkId
        ? backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId })
        : Promise.resolve(undefined),
    [networkId],
  );

  if (isContract) {
    return (
      <BasicAddressBadge
        badgeType="warning"
        title={intl.formatMessage({
          id: ETranslations.global_contract,
        })}
        content={intl.formatMessage({
          id: ETranslations.address_input_contract_popover,
        })}
      />
    );
  }

  switch (status) {
    case EAddressInteractionStatus.NOT_INTERACTED:
      return (
        <BasicAddressBadge
          badgeType="warning"
          title={intl.formatMessage({
            id: ETranslations.send_label_first_transfer,
          })}
          content={intl.formatMessage(
            {
              id: ETranslations.address_input_first_transfer_popover,
            },
            { network: result?.name ?? '' },
          )}
        />
      );
    case EAddressInteractionStatus.INTERACTED:
      return (
        <BasicAddressBadge
          badgeType="info"
          title={intl.formatMessage({
            id: ETranslations.send_label_transferred,
          })}
          content={intl.formatMessage({
            id: ETranslations.address_input_transferred_popover,
          })}
        />
      );
    default:
      return null;
  }
}

export const AddressBadge = memo(AddressBadgeFrame);
