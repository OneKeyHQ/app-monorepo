import React, { PropsWithChildren } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { Provider } from '@onekeyhq/components';

import store from './store';
import { locales } from './locale';

type LocalesTypes = typeof locales;

type Props = {
  language: keyof LocalesTypes;
};

export const KitProvider: React.FC<PropsWithChildren<Props>> = ({
  language,
  children,
}) => {
  const messages = locales[language] || locales.en;

  return (
    <ReduxProvider store={store}>
      <Provider>
        <IntlProvider locale={language} messages={messages}>
          {children}
        </IntlProvider>
      </Provider>
    </ReduxProvider>
  );
};
