import type { ReactElement } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAddressInteractionStatus } from '@onekeyhq/shared/types/address';

interface IBasicAddressBadgeProps {
  title: string;
  icon?: IKeyOfIcons;
  content?: ReactElement | string;
  badgeType: IBadgeProps['badgeType'];
}

function BasicAddressBadge({
  title,
  icon,
  content,
  badgeType,
}: IBasicAddressBadgeProps) {
  const badgeElement = useMemo(
    () => (
      <Badge badgeType={badgeType} badgeSize="sm">
        <XStack gap="$1" alignItems="center" userSelect="none">
          {icon ? <Icon name={icon} size="$4" /> : null}
          <Badge.Text> {title}</Badge.Text>
        </XStack>
      </Badge>
    ),
    [badgeType, icon, title],
  );
  return content ? (
    <Popover
      placement="bottom-start"
      title={title}
      renderTrigger={badgeElement}
      renderContent={() => (
        <Stack gap="$4" p="$4">
          <SizableText size="$bodyMd">{content}</SizableText>
        </Stack>
      )}
    />
  ) : (
    badgeElement
  );
}

export interface IAddressBadgeProps {
  title?: string;
  status?: EAddressInteractionStatus;
  networkId?: string;
  isContract?: boolean;
}

function AddressBadgeFrame({
  title,
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

  if (title) {
    return (
      <BasicAddressBadge
        badgeType="default"
        icon="Document2Outline"
        title={title}
      />
    );
  }

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
