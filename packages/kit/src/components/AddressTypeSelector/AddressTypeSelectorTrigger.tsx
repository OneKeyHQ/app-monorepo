import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Icon } from '@onekeyhq/components';
import type { IAccountDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';

type IProps = {
  activeDeriveInfo: IAccountDeriveInfo | undefined;
  disableSelector?: boolean;
  testID?: string;
};

function AddressTypeSelectorTrigger(props: IProps) {
  const { activeDeriveInfo, disableSelector, testID } = props;
  const intl = useIntl();

  if (!activeDeriveInfo) {
    return null;
  }

  return (
    <Badge
      testID={testID}
      userSelect="none"
      role="button"
      pr={disableSelector ? undefined : '$1'}
      gap="$0.5"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      $platform-native={{
        hitSlop: {
          top: 8,
          bottom: 8,
          left: 8,
          right: 8,
        },
      }}
      focusable
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineOffset: 0,
      }}
    >
      <Badge.Text>
        {activeDeriveInfo.labelKey
          ? intl.formatMessage({ id: activeDeriveInfo.labelKey })
          : activeDeriveInfo.label}
      </Badge.Text>
      {disableSelector ? null : (
        <Icon size="$4" name="ChevronDownSmallOutline" color="$iconSubdued" />
      )}
    </Badge>
  );
}

export default memo(AddressTypeSelectorTrigger);
