import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Empty, type IYStackProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// `title` overrides the default holdings-semantics copy for flows that do not
// care about holdings (e.g. Receive); `illustration` overrides the shared one
// (search empties use SearchDocument). The Android height convention stays.
function EmptyToken(
  props: IYStackProps & {
    title?: string;
    illustration?: ComponentProps<typeof Empty>['illustration'];
  },
) {
  const intl = useIntl();

  return (
    <Empty
      h={platformEnv.isNativeAndroid ? 300 : undefined}
      testID="Wallet-No-Token-Empty"
      illustration="QuestionMark"
      title={intl.formatMessage({ id: ETranslations.send_no_token_message })}
      {...props}
    />
  );
}

export { EmptyToken };
