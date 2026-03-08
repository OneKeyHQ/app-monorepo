import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BorrowInfoItem } from '../../../BorrowInfoItem';
import { ApyTextV2 } from '../../../BorrowTableList/ApyTextV2';

import type { IApyInfoProps } from '../../types';

export function ApyInfo({ action, data }: IApyInfoProps) {
  const intl = useIntl();

  const title =
    action === 'supply' || action === 'withdraw'
      ? intl.formatMessage({ id: ETranslations.defi_supply_apy })
      : intl.formatMessage({ id: ETranslations.defi_borrow_apy });

  return (
    <BorrowInfoItem title={title}>
      <ApyTextV2 apyDetail={data} triggerMode="icon" />
    </BorrowInfoItem>
  );
}
