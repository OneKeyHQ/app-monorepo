import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList, Button } from '@onekeyhq/components';
import { BorrowTestIDs } from '@onekeyhq/kit/src/views/Borrow/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// The remedy for an underfunded step, sized to sit in the page footer next to
// the blocked action — the shape Send uses when a balance is short (see its
// insufficient-funds footer). No trailing chevron: at half the footer width the
// glyph costs room the label needs once it is German or Russian, and a footer
// button opening a sheet is the platform's own convention.
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
  // The button stays symbol-free — the step above it already names the token
  // three times. The sheet keeps the symbol, where there is room to be explicit.
  const sheetTitle = intl.formatMessage(
    { id: ETranslations.defi_emode_get_symbol__action },
    { symbol },
  );

  return (
    <ActionList
      title={sheetTitle}
      // Opens upward: the trigger sits on the bottom edge of the page.
      placement="top"
      items={items}
      renderTrigger={
        <Button
          testID={BorrowTestIDs.eModeNeedActionGetFundsBtn}
          variant="primary"
          flexGrow={1}
          flexShrink={1}
          textEllipsis
          $md={
            {
              size: 'large',
            } as any
          }
          aria-label={sheetTitle}
          onPress={onPress}
        >
          {intl.formatMessage({ id: ETranslations.global_top_up })}
        </Button>
      }
    />
  );
}
