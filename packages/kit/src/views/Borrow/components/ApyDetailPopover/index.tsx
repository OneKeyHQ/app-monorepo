import { useState } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Popover } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowApy } from '@onekeyhq/shared/types/staking';

import { ApyDetailPopoverContent } from '../BorrowTableList/ApyTextV2';

type IApyDetailPopoverTriggerProps = {
  apyDetail?: IBorrowApy;
};

export function ApyDetailPopoverTrigger({
  apyDetail,
}: IApyDetailPopoverTriggerProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  const hasDetail = !!apyDetail?.button;
  const popupData = apyDetail?.button?.data;

  if (!hasDetail) {
    return null;
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      renderTrigger={
        <IconButton
          icon="CoinsAddOutline"
          size="small"
          variant="tertiary"
          iconColor="$iconSubdued"
        />
      }
      title={intl.formatMessage({ id: ETranslations.global_details })}
      renderContent={<ApyDetailPopoverContent popupData={popupData} />}
    />
  );
}
