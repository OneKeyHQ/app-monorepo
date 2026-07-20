import type { ComponentType } from 'react';

import {
  addEventProcessor,
  breadcrumbsIntegration,
  browserApiErrorsIntegration,
  captureException,
  init,
  makeBrowserOfflineTransport,
  makeFetchTransport,
  setUser,
  withErrorBoundary,
  withProfiler,
} from '@sentry/react';

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

export { addEventProcessor, captureException, setUser };

export * from './basicOptions';

const sentryRuntime = {
  breadcrumbsIntegration,
  makeBrowserOfflineTransport,
  makeFetchTransport,
};

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  init({
    dsn: process.env.SENTRY_DSN_WEB || '',
    // Associate runtime events with the sourcemaps uploaded by CI. The web
    // rspack build has no in-build Sentry plugin, so release-web.yml uploads
    // maps via `sentry-cli sourcemaps upload --release "$RELEASE"` (no
    // `inject`, to keep the build-time SRI hashes valid). With no injected
    // debug-ids, mapping a stack trace back to source relies entirely on the
    // release name matching — so it MUST equal the CI `$RELEASE`
    // ("$BUILD_APP_VERSION ($BUILD_NUMBER)").
    // Both derive from the same source: process.env.VERSION is `.env.version`'s
    // VERSION (= BUILD_APP_VERSION) and BUILD_NUMBER is the CI build number —
    // identical to the release the webpack sentry plugin used (webpack.prod.config.js).
    release: `${process.env.VERSION ?? ''} (${process.env.BUILD_NUMBER ?? ''})`,
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
    ...buildSentryOptions(sentryRuntime),
    integrations: [
      ...buildIntegrations(sentryRuntime),
      // https://github.com/getsentry/sentry-javascript/issues/3040
      browserApiErrorsIntegration({
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
  withErrorBoundary(withProfiler(Component), {
    onError: (error, info) => {
      console.error('error', error, info);
    },
    fallback: errorBoundaryFallback,
  });
