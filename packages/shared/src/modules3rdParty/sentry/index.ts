import type { ComponentType } from 'react';

import * as Sentry from '@sentry/react';

import {
  EWebEmbedPostMessageType,
  postMessage,
} from '@onekeyhq/shared/src/modules3rdParty/webEmebd/postMessage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import appGlobals from '../../appGlobals';

import {
  buildBasicOptions,
  buildIntegrations,
  buildSentryOptions,
} from './basicOptions';

import type { FallbackRender } from '@sentry/react';

export * from '@sentry/react';

export * from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN_WEB || '',
    ...buildBasicOptions({
      onError: (errorMessage, stacktrace) => {
        appGlobals.$defaultLogger?.app.error.log(errorMessage, stacktrace);
        if (platformEnv.isWebEmbed) {
          postMessage({
            type: EWebEmbedPostMessageType.CaptureException,
            data: {
              error: errorMessage,
              stacktrace,
            },
          });
        }
      },
    }),
    ...buildSentryOptions(Sentry),
    integrations: [
      ...buildIntegrations(Sentry),
      // https://github.com/getsentry/sentry-javascript/issues/3040
      Sentry.browserApiErrorsIntegration({
        eventTarget: false,
      }),
    ],
  });
};

export const nativeCrash = () => {};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const addBreadcrumb = (args: any) => {};

export const withSentryHOC = (
  Component: ComponentType<any>,
  errorBoundaryFallback?: FallbackRender,
): ComponentType<any> =>
  Sentry.withErrorBoundary(Sentry.withProfiler(Component), {
    onError: (error, info) => {
      console.error('error', error, info);
    },
    fallback: errorBoundaryFallback,
  });
