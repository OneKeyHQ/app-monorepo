import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

export const groupBy = <T extends { createdAt: number }>(items: T[]) => {
  const resp = items.reduce((acc, item) => {
    const title = formatDate(new Date(item.createdAt), {
      hideTimeForever: true,
    });
    if (!acc[title]) {
      acc[title] = [];
    }
    acc[title].push(item);
    return acc;
  }, {} as Record<string, T[]>);
  return Object.entries(resp).map(([title, data]) => ({
    title,
    data,
  })) as { title: string; data: T[] }[];
};
