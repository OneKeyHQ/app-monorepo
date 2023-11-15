import { type FC, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { ERROR_CODE } from 'react-native-webview/lib/WebViewShared';

import { Empty, Stack } from '@onekeyhq/components';
import type EnLanguage from '@onekeyhq/components/src/locale/en-US.json';

type ILanguageId = keyof typeof EnLanguage;

interface IErrorViewProps {
  errorCode?: number;
  onRefresh: () => void;
}

const ErrorView: FC<IErrorViewProps> = ({ errorCode, onRefresh }) => {
  const intl = useIntl();
  const messages: {
    title: ILanguageId;
    subTitle: ILanguageId;
  } = useMemo(() => {
    if (errorCode === ERROR_CODE.CONNECTION_FAILED) {
      return {
        title: 'title__connection_refused',
        subTitle: 'title__connection_refused_desc',
      };
    }
    return {
      title: 'title__no_connection',
      subTitle: 'title__no_connection_desc',
    };
  }, [errorCode]);

  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Empty
        icon="CloudOffOutline"
        title={intl.formatMessage({ id: messages.title })}
        description={intl.formatMessage({ id: messages.subTitle })}
        buttonProps={{
          children: intl.formatMessage({ id: 'action__refresh' }),
          onPress: () => onRefresh?.(),
        }}
      />
    </Stack>
  );
};
export default ErrorView;
