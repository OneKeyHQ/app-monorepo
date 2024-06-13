import { type FC, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { ERROR_CODE } from 'react-native-webview/lib/WebViewShared';

import { Empty, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IErrorViewProps {
  errorCode?: number;
  onRefresh: () => void;
}

const ErrorView: FC<IErrorViewProps> = ({ errorCode, onRefresh }) => {
  const intl = useIntl();
  const messages: {
    title: ETranslations;
    subTitle: ETranslations;
  } = useMemo(() => {
    if (errorCode === ERROR_CODE.CONNECTION_FAILED) {
      return {
        title: ETranslations.global_connection_failed,
        subTitle: ETranslations.global_connection_failed,
      };
    }
    return {
      title: ETranslations.global_network_error,
      subTitle: ETranslations.explore_network_issue_detected,
    };
  }, [errorCode]);

  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Empty
        icon="CloudOffOutline"
        title={intl.formatMessage({ id: messages.title })}
        description={intl.formatMessage({ id: messages.subTitle })}
        buttonProps={{
          children: intl.formatMessage({ id: ETranslations.global_refresh }),
          onPress: () => onRefresh?.(),
          testID: 'error-view-refresh',
        }}
      />
    </Stack>
  );
};
export default ErrorView;
