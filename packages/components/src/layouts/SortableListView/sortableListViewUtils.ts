import type { IDragEndParams, IDragEndParamsWithItem } from './types';

function convertToDragEndParamsWithItem<T>(
  params: IDragEndParams<T>,
): IDragEndParamsWithItem<T> {
  const { data, from, to } = params;
  const dragItem = data[to];
  const prevItem: T | undefined = data[to - 1];
  const nextItem: T | undefined = data[to + 1];
  return {
    dragItem,
    prevItem,
    nextItem,
    data,
    from,
    to,
  };
}

export default { convertToDragEndParamsWithItem };
