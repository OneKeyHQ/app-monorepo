import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Icon, XStack } from '@onekeyhq/components';
import type { IAccountDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';

type IProps = {
  activeDeriveInfo: IAccountDeriveInfo | undefined;
  disableSelector?: boolean;
};

function AddressTypeSelectorTrigger(props: IProps) {
  const { activeDeriveInfo, disableSelector } = props;
  const intl = useIntl();

  if (!activeDeriveInfo) {
    return null;
  }

  return (
    <Badge cursor="pointer">
      <XStack alignItems="center" gap="$1">
        <Badge.Text>
          {activeDeriveInfo.labelKey
            ? intl.formatMessage({ id: activeDeriveInfo.labelKey })
            : activeDeriveInfo.label}
        </Badge.Text>
      </XStack>
      {disableSelector ? null : (
        <Icon size="$4" name="ChevronDownSmallOutline" color="$iconSubdued" />
      )}
    </Badge>
  );
}

export default memo(AddressTypeSelectorTrigger);
