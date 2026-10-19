import { useIntl } from 'react-intl';

import type { IBreadcrumbItem, IBreadcrumbProps } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnNavigation } from '../earnUtils';

/**
 * Desktop trail back to the Earn home, as the protocol pages have it. The
 * desktop header has no back button, so this is the way back.
 */
export function usePoolsBreadcrumb(items: IBreadcrumbItem[]): IBreadcrumbProps {
  const intl = useIntl();
  const navigation = useAppNavigation();
  return {
    items: [
      {
        label: intl.formatMessage({ id: ETranslations.global_earn }),
        onClick: () => {
          void EarnNavigation.popToEarnHome(navigation);
        },
      },
      ...items,
    ],
  };
}
