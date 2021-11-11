/* eslint-disable no-undef */
import isDev from 'electron-is-dev';
import { MODULES, MODULES_DEV, MODULES_PROD } from './constants';

const modules = async (dependencies: Dependencies): Promise<void> => {
  const { logger } = global;

  logger.info('modules', `Loading ${MODULES.length} modules`);

  await Promise.all(
    [...MODULES, ...(isDev ? MODULES_DEV : MODULES_PROD)].flatMap(
      async (module) => {
        logger.debug('modules', `Loading ${module}`);

        try {
          const m = (await import(`./modules/${module}`)) as {
            default(d: Dependencies): void;
          };
          return [m.default(dependencies)];
        } catch (err) {
          if (err instanceof Error) {
            logger.error(
              'modules',
              `Couldn't load ${module} (${err.toString()})`,
            );
          }
        }
      },
    ),
  );

  logger.info('modules', 'All modules loaded');
};

export default modules;
