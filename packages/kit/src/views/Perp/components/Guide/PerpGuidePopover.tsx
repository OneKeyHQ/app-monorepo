import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Popover } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpGuideContent } from './PerpGuideContent';

export function PerpGuidePopover({
  renderTrigger,
}: {
  renderTrigger?: ReactNode;
}) {
  const intl = useIntl();

  const trigger = renderTrigger ?? (
    <IconButton
      icon="QuestionmarkOutline"
      size="small"
      variant="tertiary"
      iconColor="$iconSubdued"
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
        renderContent={({ closePopover }) => (
          <PerpGuideContent onClose={closePopover} />
        )}
        floatingPanelProps={{
          width: 380,
        }}
      />
    </PerpsProviderMirror>
  );
}
