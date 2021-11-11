/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/**
 * Request Filter feature (blocks non-allowed requests and displays a warning)
 */
import { dialog, session } from 'electron';

import * as config from '../config';

const init = ({ mainWindow }: Dependencies) => {
  const { logger } = global;

  const resourceTypeFilter = ['xhr']; // What resource types we want to filter
  const caughtDomainExceptions: string[] = []; // Domains that have already shown an exception
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['*://*/*'] },
    (details, cb) => {
      if (!resourceTypeFilter.includes(details.resourceType)) {
        logger.debug(
          'request-filter',
          `${details.url} was allowed because its resource type (${details.resourceType}) is not filtered`,
        );
        cb({ cancel: false });
        return;
      }

      const { hostname } = new URL(details.url);

      if (
        config.allowedDomains.find((d) => hostname.endsWith(d)) !== undefined
      ) {
        logger.info(
          'request-filter',
          `${details.url} was allowed because ${hostname} is in the exception list`,
        );
        cb({ cancel: false });
        return;
      }

      if (caughtDomainExceptions.find((d) => d === hostname) === undefined) {
        caughtDomainExceptions.push(hostname);
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          message: `Suite blocked a request to ${hostname}.\n\nIf you believe this is an error, please contact our support.`,
          buttons: ['OK'],
        });
      }

      logger.warn(
        'request-filter',
        `${details.url} was blocked because ${hostname} is not in the exception list`,
      );
      cb({ cancel: true });
    },
  );
};

export default init;
