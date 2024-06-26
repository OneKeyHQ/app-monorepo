import { memo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';

type IProps = { createAddressDisabled?: boolean } & IXStackProps;

function HomeSelector(props: IProps) {
  const media = useMedia();
  const num = 0;

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
            <XStack
              testID="wallet-derivation-path-selector-trigger"
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
                  right: 16,
                  top: 16,
                  bottom: 16,
                },
              }}
              focusable
            >
              <Icon name="BranchesOutline" color="$iconSubdued" size="$4.5" />
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
          )}
          num={num}
        />
      ) : null}
    </XStack>
  );
}

export default memo(HomeSelector);
