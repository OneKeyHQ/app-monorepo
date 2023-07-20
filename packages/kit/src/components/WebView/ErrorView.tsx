import { type FC, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { ERROR_CODE } from 'react-native-webview/lib/WebViewShared';

import { Button, Center, Empty } from '@onekeyhq/components';
import type EnLanguage from '@onekeyhq/components/src/locale/en-US.json';

// eslint-disable-next-line @typescript-eslint/naming-convention
type messageId = keyof typeof EnLanguage;

interface ErrorViewProps {
  errorCode: number;
  onRefresh: () => void;
}

const ErrorView: FC<ErrorViewProps> = ({ errorCode, onRefresh }) => {
  const intl = useIntl();
  const messages: {
    title: messageId;
    subTitle: messageId;
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
    <Center w="full" h="full" bg="background-default">
      <Empty
        emoji="🌐"
        title={intl.formatMessage({ id: messages.title })}
        subTitle={intl.formatMessage({ id: messages.subTitle })}
        mb={3}
      />
      <Button
        mt={6}
        size="lg"
        type="primary"
        leftIconName="ArrowPathOutline"
        onPress={onRefresh}
      >
        {intl.formatMessage({ id: 'action__refresh' })}
      </Button>
    </Center>
  );
};
export default ErrorView;
