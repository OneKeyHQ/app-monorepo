import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  Tooltip,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = { createAddressDisabled?: boolean } & IXStackProps;

function HomeSelector(props: IProps) {
  const intl = useIntl();
  const num = 0;
  const media = useMedia();

  const { createAddressDisabled, ...rest } = props;

  return (
    <XStack
      testID="Wallet-Address-Generator"
      alignItems="center"
      space="$3"
      {...rest}
    >
      <NetworkSelectorTriggerHome num={num} />
      {!createAddressDisabled ? (
        <AccountSelectorActiveAccountHome num={num} />
      ) : null}
      {!createAddressDisabled ? (
        <DeriveTypeSelectorTrigger
          renderTrigger={({ label }) => (
            <Tooltip
              placement="top"
              renderContent={intl.formatMessage({
                id: ETranslations.global_switch_address,
              })}
              renderTrigger={
                <XStack
                  role="button"
                  borderRadius="$2"
                  userSelect="none"
                  alignItems="center"
                  p="$1"
                  my="$-1"
                  hoverStyle={{
                    bg: '$bgHover',
                  }}
                  pressStyle={{
                    bg: '$bgActive',
                  }}
                  focusStyle={{
                    outlineWidth: 2,
                    outlineOffset: 0,
                    outlineColor: '$focusRing',
                    outlineStyle: 'solid',
                  }}
                  $platform-native={{
                    hitSlop: {
                      right: 8,
                      top: 8,
                      bottom: 8,
                    },
                  }}
                  focusable
                >
                  <Icon name="RepeatOutline" color="$iconSubdued" size="$4.5" />
                  {media.gtSm ? (
                    <SizableText
                      pl="$2"
                      pr="$1"
                      size="$bodyMd"
                      color="$textSubdued"
                    >
                      {label}
                    </SizableText>
                  ) : null}
                </XStack>
              }
            />
          )}
          num={num}
        />
      ) : null}
    </XStack>
  );
}

export default memo(HomeSelector);
