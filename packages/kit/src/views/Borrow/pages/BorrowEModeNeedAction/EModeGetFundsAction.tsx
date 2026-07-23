import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList, SizableText, XStack } from '@onekeyhq/components';
import { BorrowTestIDs } from '@onekeyhq/kit/src/views/Borrow/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function EModeGetFundsAction({
  symbol,
  items,
  onPress,
}: {
  symbol: string;
  items: IActionListItemProps[];
  onPress: () => void;
}) {
  const intl = useIntl();
  const label = intl.formatMessage(
    { id: ETranslations.defi_emode_get_symbol__action },
    { symbol },
  );

  return (
    <XStack alignSelf="flex-start">
      <ActionList
        title={label}
        placement="bottom-start"
        items={items}
        renderTrigger={
          <XStack
            testID={BorrowTestIDs.eModeNeedActionGetFundsBtn}
            ai="center"
            cursor="pointer"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
            focusable
            focusVisibleStyle={{
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
              outlineWidth: 2,
            }}
            role="button"
            aria-label={label}
            onPress={onPress}
          >
            <SizableText size="$bodyMdMedium" color="$textInfo">
              {label}
            </SizableText>
          </XStack>
        }
      />
    </XStack>
  );
}
