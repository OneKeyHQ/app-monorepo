import { type FC, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { ERROR_CODE } from 'react-native-webview/lib/WebViewShared';

import { Button, Stack, Text } from '@onekeyhq/components';
import type EnLanguage from '@onekeyhq/components/src/locale/en-US.json';

type LanguageId = keyof typeof EnLanguage;

interface ErrorViewProps {
  errorCode?: number;
  onRefresh: () => void;
}

const ErrorView: FC<ErrorViewProps> = ({ errorCode, onRefresh }) => {
  const intl = useIntl();
  const messages: {
    title: LanguageId;
    subTitle: LanguageId;
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
    <Stack w="full" h="full" bg="background-default">
      {/* TODO: REPLACE_COMPONENT Empty */}
      <Stack mb={3}>
        <Text>{intl.formatMessage({ id: messages.title })}</Text>
        <Text>{intl.formatMessage({ id: messages.subTitle })}</Text>
      </Stack>
      <Button
        mt={6}
        size="large"
        variant="primary"
        icon="ArrowPathUpOutline"
        onPress={onRefresh}
      >
        {intl.formatMessage({ id: 'action__refresh' })}
      </Button>
    </Stack>
  );
};
export default ErrorView;
