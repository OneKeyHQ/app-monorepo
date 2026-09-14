import { useIntl } from 'react-intl';

import { Empty, type IYStackProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// `title` overrides the default holdings-semantics copy for flows that do not
// care about holdings (e.g. Receive), keeping the shared illustration and the
// Android height convention.
function EmptyToken(props: IYStackProps & { title?: string }) {
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
