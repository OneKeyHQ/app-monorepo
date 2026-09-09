import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Button, Page, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { BorrowTestIDs } from '../testIDs';

const ACTION_BAR_HEIGHT = 72;

// Native content scrolls underneath the absolutely positioned action bar.
export const BORROW_MOBILE_ACTION_BAR_SCROLL_INSET = platformEnv.isNative
  ? ACTION_BAR_HEIGHT
  : 0;

type IBorrowMobileActionBarProps = {
  isActive?: boolean;
  disabled?: boolean;
  bottomOffset?: number;
  onSupply: () => void;
  onBorrow: () => void;
};

export function BorrowMobileActionBar({
  isActive = true,
  disabled = false,
  bottomOffset = 0,
  onSupply,
  onBorrow,
}: IBorrowMobileActionBarProps) {
  const intl = useIntl();

  // The web footer is outside this subtree and must be hidden with its tab.
  if (!platformEnv.isNative && !isActive) {
    return null;
  }

  const buttons = (
    <>
      <Button
        testID={BorrowTestIDs.mobileSupplyBtn}
        flex={1}
        size="large"
        variant="secondary"
        disabled={disabled}
        onPress={onSupply}
      >
        {intl.formatMessage({ id: ETranslations.defi_supply })}
      </Button>
      <Button
        testID={BorrowTestIDs.mobileBorrowBtn}
        flex={1}
        size="large"
        variant="primary"
        disabled={disabled}
        onPress={onBorrow}
      >
        {intl.formatMessage({ id: ETranslations.global_borrow })}
      </Button>
    </>
  );

  const barProps = {
    px: '$5',
    py: '$3',
    gap: '$3',
    bg: '$bgApp',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '$borderSubdued',
  } as const;

  if (platformEnv.isNative) {
    return (
      <XStack
        {...barProps}
        position="absolute"
        left={0}
        right={0}
        bottom={bottomOffset}
      >
        {buttons}
      </XStack>
    );
  }

  return (
    <Page.Footer>
      <XStack {...barProps}>{buttons}</XStack>
    </Page.Footer>
  );
}
