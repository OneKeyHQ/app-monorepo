import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList, Button } from '@onekeyhq/components';
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
  // The button stays symbol-free — the row it sits in already names the token
  // twice. The sheet keeps the symbol, where there is room to be explicit.
  const sheetTitle = intl.formatMessage(
    { id: ETranslations.defi_emode_get_symbol__action },
    { symbol },
  );

  return (
    <ActionList
      title={sheetTitle}
      placement="bottom-end"
      items={items}
      renderTrigger={
        <Button
          testID={BorrowTestIDs.eModeNeedActionGetFundsBtn}
          variant="secondary"
          size="small"
          iconAfter="ChevronDownSmallOutline"
          aria-label={sheetTitle}
          onPress={onPress}
        >
          {intl.formatMessage({ id: ETranslations.global_top_up })}
        </Button>
      }
    />
  );
}
