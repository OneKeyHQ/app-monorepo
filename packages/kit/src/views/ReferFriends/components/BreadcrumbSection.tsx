import { useIntl } from 'react-intl';

import { Breadcrumb } from '@onekeyhq/components';
import type { IBreadcrumbItem } from '@onekeyhq/components/src/content/Breadcrumb';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useReplaceToReferAFriend } from '../pages/ReferAFriend/hooks/useNavigateToReferAFriend';

export interface IBreadcrumbSectionProps {
  secondItemLabel: string;
}

export function BreadcrumbSection({
  secondItemLabel,
}: IBreadcrumbSectionProps) {
  const intl = useIntl();
  const replaceToReferAFriend = useReplaceToReferAFriend();

  const breadcrumbItems: IBreadcrumbItem[] = [
    {
      label: intl.formatMessage({ id: ETranslations.global_overview }),
      onClick: () => {
        replaceToReferAFriend({});
      },
    },
    {
      label: secondItemLabel,
    },
  ];

  return <Breadcrumb items={breadcrumbItems} />;
}
