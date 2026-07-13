import { memo, useEffect, useState } from 'react';
import type { ComponentType } from 'react';

const CHART_MIGRATION_MOUNT_DELAY_MS = 1000;

function ChartMigrationContainerLazyCmp() {
  const [ContainerImpl, setContainerImpl] = useState<ComponentType | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      void import('../../components/TradingView/ChartMigration')
        .then((module) => {
          if (isMounted) {
            setContainerImpl(() => module.ChartMigration);
          }
        })
        .catch((error: Error) => {
          console.error('Failed to load ChartMigration:', error);
        });
    }, CHART_MIGRATION_MOUNT_DELAY_MS);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  return ContainerImpl ? <ContainerImpl /> : null;
}

export const ChartMigrationContainerLazy = memo(ChartMigrationContainerLazyCmp);
