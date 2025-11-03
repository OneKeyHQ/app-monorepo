import { useIntl } from 'react-intl';

import { Breadcrumb } from '@onekeyhq/components';
import type { IBreadcrumbItem } from '@onekeyhq/components/src/content/Breadcrumb';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

export function BreadcrumbSection() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const breadcrumbItems: IBreadcrumbItem[] = [
    {
      label: intl.formatMessage({ id: ETranslations.global_overview }),
      onClick: () => {
        navigation.replace(ETabReferFriendsRoutes.TabReferAFriend, {});
      },
    },
    {
      label: intl.formatMessage({ id: ETranslations.referral_referral_level }),
    },
  ];

  return <Breadcrumb items={breadcrumbItems} />;
}
