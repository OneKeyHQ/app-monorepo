import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Checkbox,
  Dialog,
  Divider,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { CheckedState } from '@onekeyhq/components/src/shared/tamagui';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import SignGuardIcon from './SignGuardIcon';

// Compare two addresses and return diff info for each character
// Marks everything between first left diff and first right diff as different
function compareAddresses(
  baseAddress: string,
  targetAddress: string,
): { char: string; isDiff: boolean }[] {
  const result: { char: string; isDiff: boolean }[] = [];
  const len = targetAddress.length;

  // Find matching prefix length
  let prefixMatch = 0;
  for (let i = 0; i < len && i < baseAddress.length; i += 1) {
    if (baseAddress[i].toLowerCase() !== targetAddress[i].toLowerCase()) break;
    prefixMatch += 1;
  }

  // Find matching suffix length
  let suffixMatch = 0;
  for (let i = 1; i <= len && i <= baseAddress.length; i += 1) {
    if (
      baseAddress[baseAddress.length - i].toLowerCase() !==
      targetAddress[len - i].toLowerCase()
    )
      break;
    suffixMatch += 1;
  }

  // Build result: prefix is white, middle is red, suffix is white
  for (let i = 0; i < len; i += 1) {
    const isInPrefix = i < prefixMatch;
    const isInSuffix = i >= len - suffixMatch;
    result.push({
      char: targetAddress[i],
      isDiff: !isInPrefix && !isInSuffix,
    });
  }

  return result;
}

// Format address into groups of 4 characters with space separator
function formatAddressInGroups(address: string, groupSize = 4): string {
  const groups: string[] = [];
  for (let i = 0; i < address.length; i += groupSize) {
    groups.push(address.slice(i, i + groupSize));
  }
  return groups.join(' ');
}

// Render address with diff highlighting
function AddressWithDiff({
  diffResult,
  groupSize = 4,
}: {
  diffResult: { char: string; isDiff: boolean }[];
  groupSize?: number;
}) {
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < diffResult.length; i += 1) {
    const { char, isDiff } = diffResult[i];

    // Add space before group (except first group)
    if (i > 0 && i % groupSize === 0) {
      elements.push(' ');
    }

    elements.push(
      <SizableText
        key={i}
        fontFamily="$monoMedium"
        color={isDiff ? '$textCritical' : '$text'}
      >
        {char}
      </SizableText>,
    );
  }

  return (
    <SizableText fontFamily="$monoMedium" flexWrap="wrap">
      {elements}
    </SizableText>
  );
}

function SimilarAddressContent({
  similarAddress,
  currentAddress,
  onConfirm,
  onCancel,
}: {
  similarAddress: string;
  currentAddress: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const intl = useIntl();
  const diffResult = useMemo(
    () => compareAddresses(similarAddress, currentAddress),
    [similarAddress, currentAddress],
  );

  const formattedSimilarAddress = useMemo(
    () => formatAddressInGroups(similarAddress),
    [similarAddress],
  );

  const [checkState, setCheckState] = useState(false as CheckedState);

  return (
    <YStack gap="$5">
      <YStack
        gap="$4"
        p="$4"
        userSelect="none"
        borderRadius="$3"
        borderCurve="continuous"
        $platform-web={{
          boxShadow:
            '0 1px 1px 0 rgba(255, 255, 255, 0.05) inset, 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        }}
        $platform-native={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$borderSubdued',
        }}
        $theme-dark={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$borderSubdued',
        }}
        $platform-ios={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 0.5 },
          shadowOpacity: 0.2,
          shadowRadius: 0.5,
        }}
      >
        <YStack gap={6}>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.wallet_your_usual_address,
            })}
          </SizableText>
          <SizableText fontFamily="$monoMedium">
            {formattedSimilarAddress}
          </SizableText>
        </YStack>

        <YStack gap={6}>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.wallet_this_address,
            })}
          </SizableText>
          <AddressWithDiff diffResult={diffResult} />
        </YStack>
      </YStack>
      <YStack gap="$1">
        <SizableText size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.wallet_what_you_should_do_now,
          })}
        </SizableText>
        <SizableText size="$bodySm" color="$textDisabled">
          {intl.formatMessage({
            id: ETranslations.wallet_do_not_proceed_tip,
          })}
        </SizableText>
      </YStack>
      <XStack gap="$3" alignItems="center">
        <Divider />
        <SignGuardIcon />
        <Divider />
      </XStack>
      <YStack gap="$6">
        <Checkbox
          value={checkState}
          label={intl.formatMessage({
            id: ETranslations.wallet_i_understand_risks_and_proceed,
          })}
          onChange={setCheckState}
        />
        <Dialog.Footer
          onConfirm={onConfirm}
          onCancel={onCancel}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_continue,
          })}
          onCancelText={intl.formatMessage({
            id: ETranslations.global_cancel,
          })}
          confirmButtonProps={{
            disabled: !checkState,
          }}
        />
      </YStack>
    </YStack>
  );
}

export const showSimilarAddressDialog = async ({
  similarAddress,
  currentAddress,
}: {
  similarAddress: string;
  currentAddress: string;
}) => {
  return new Promise((resolve, reject) => {
    const dialog = Dialog.show({
      title: appLocale.intl.formatMessage({
        id: ETranslations.wallet_high_risk_address_detected,
      }),
      icon: 'ShieldOutline',
      tone: 'warning',
      showConfirmButton: false,
      showCancelButton: false,
      renderContent: (
        <SimilarAddressContent
          similarAddress={similarAddress}
          currentAddress={currentAddress}
          onConfirm={() => {
            resolve(true);
            void dialog.close();
          }}
          onCancel={() => {
            reject(new OneKeyLocalError('User canceled'));
            void dialog.close();
          }}
        />
      ),
    });
  });
};
