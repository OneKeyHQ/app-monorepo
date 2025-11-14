import { useIntl } from 'react-intl';

import { Breadcrumb } from '@onekeyhq/components';
import type { IBreadcrumbItem } from '@onekeyhq/components/src/content/Breadcrumb';
import { useReplaceToReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IBreadcrumbSectionProps {
  secondItemLabel: string;
}

export function BreadcrumbSection({
  secondItemLabel,
}: IBreadcrumbSectionProps) {
  const intl = useIntl();
  const replaceToReferFriends = useReplaceToReferFriends();

  const breadcrumbItems: IBreadcrumbItem[] = [
    {
      label: intl.formatMessage({ id: ETranslations.global_overview }),
      onClick: () => {
        void replaceToReferFriends({});
      },
    },
    {
      label: secondItemLabel,
    },
  ];

  return <Breadcrumb items={breadcrumbItems} />;
}
