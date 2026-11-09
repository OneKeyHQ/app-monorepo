import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Popover } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpGuideContent } from './PerpGuideContent';

function PerpGuidePopoverContent({
  closePopover,
}: {
  closePopover: () => void;
}) {
  return <PerpGuideContent onClose={closePopover} />;
}

export function PerpGuidePopover({
  renderTrigger,
}: {
  renderTrigger?: ReactNode;
}) {
  const intl = useIntl();

  const trigger = renderTrigger ?? (
    <IconButton
      testID="perp-trigger-icon-btn"
      icon="BookOpenOutline"
      size="small"
      variant="tertiary"
      cursor="default"
    />
  );

  return (
    <PerpsProviderMirror>
      <Popover
        title={intl.formatMessage({
          id: ETranslations.perp_guide_help_center,
        })}
        renderTrigger={trigger}
        renderContent={PerpGuidePopoverContent}
        floatingPanelProps={{
          width: 380,
          pt: '$3',
        }}
      />
    </PerpsProviderMirror>
  );
}
