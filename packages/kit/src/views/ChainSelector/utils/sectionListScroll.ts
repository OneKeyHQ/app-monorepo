type ISectionListItem = {
  id: string;
};

type ISectionListSection<T extends ISectionListItem> = {
  title?: string;
  data?: T[];
};

export const SECTION_LIST_HEADER_HEIGHT = 36;
export const SECTION_LIST_SEPARATOR_HEIGHT = 20;
export const SECTION_LIST_AUTO_SCROLL_DELAY = 80;
export const SECTION_LIST_AUTO_SCROLL_RETRY_DELAY = 30;
export const SECTION_LIST_AUTO_SCROLL_MAX_RETRIES = 20;

export function getSectionListSelectedItemLocation<T extends ISectionListItem>({
  sections,
  selectedId,
}: {
  sections: Array<ISectionListSection<T>>;
  selectedId?: string;
}) {
  if (!selectedId) {
    return undefined;
  }

  for (
    let sectionIndex = 0;
    sectionIndex < sections.length;
    sectionIndex += 1
  ) {
    const data = sections[sectionIndex]?.data ?? [];
    const itemIndex = data.findIndex((item) => item.id === selectedId);
    if (itemIndex !== -1) {
      return {
        sectionIndex,
        itemIndex,
      };
    }
  }

  return undefined;
}

export function getSectionListScrollToLocationItemIndex({
  itemIndex,
}: {
  itemIndex: number;
}) {
  return itemIndex + 1;
}

export function getSectionListSelectedItemViewOffset({
  rowHeight,
  rowsBefore = 2,
}: {
  rowHeight: number;
  rowsBefore?: number;
}) {
  return rowHeight * rowsBefore;
}

export function getSectionListItemStartOffset<T extends ISectionListItem>({
  sections,
  sectionIndex,
  itemIndex,
  rowHeight,
  listHeaderHeight = 0,
  sectionHeaderHeight = SECTION_LIST_HEADER_HEIGHT,
  sectionSeparatorHeight = SECTION_LIST_SEPARATOR_HEIGHT,
}: {
  sections: Array<ISectionListSection<T>>;
  sectionIndex: number;
  itemIndex: number;
  rowHeight: number;
  listHeaderHeight?: number;
  sectionHeaderHeight?: number;
  sectionSeparatorHeight?: number;
}) {
  let offset = listHeaderHeight;

  for (let index = 0; index < sectionIndex; index += 1) {
    const section = sections[index];
    if (index !== 0) {
      offset += sectionSeparatorHeight;
    }
    offset += section?.title ? sectionHeaderHeight : 0;
    offset += (section?.data?.length ?? 0) * rowHeight;
  }

  const targetSection = sections[sectionIndex];
  if (sectionIndex !== 0) {
    offset += sectionSeparatorHeight;
  }
  offset += targetSection?.title ? sectionHeaderHeight : 0;
  offset += itemIndex * rowHeight;

  return offset;
}

export function getSectionListSelectedItemScrollOffset<
  T extends ISectionListItem,
>({
  sections,
  sectionIndex,
  itemIndex,
  rowHeight,
  listHeaderHeight,
}: {
  sections: Array<ISectionListSection<T>>;
  sectionIndex: number;
  itemIndex: number;
  rowHeight: number;
  listHeaderHeight?: number;
}) {
  const selectedItemStartOffset = getSectionListItemStartOffset({
    sections,
    sectionIndex,
    itemIndex,
    rowHeight,
    listHeaderHeight,
  });

  return Math.max(
    selectedItemStartOffset -
      getSectionListSelectedItemViewOffset({ rowHeight }),
    0,
  );
}

export function scheduleSectionListAutoScroll(
  callback: () => boolean | void,
  {
    maxRetries = SECTION_LIST_AUTO_SCROLL_MAX_RETRIES,
    retryDelay = SECTION_LIST_AUTO_SCROLL_RETRY_DELAY,
  }: {
    maxRetries?: number;
    retryDelay?: number;
  } = {},
) {
  let retryTimes = 0;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let firstFrameId: number | undefined;
  let secondFrameId: number | undefined;

  const run = () => {
    timerId = setTimeout(
      () => {
        const runCallback = () => {
          const completed = callback() !== false;
          if (!completed && retryTimes < maxRetries) {
            retryTimes += 1;
            run();
          }
        };

        if (typeof globalThis.requestAnimationFrame !== 'function') {
          runCallback();
          return;
        }

        firstFrameId = globalThis.requestAnimationFrame(() => {
          secondFrameId = globalThis.requestAnimationFrame(runCallback);
        });
      },
      retryTimes === 0 ? SECTION_LIST_AUTO_SCROLL_DELAY : retryDelay,
    );
  };

  run();

  return () => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    if (typeof globalThis.cancelAnimationFrame !== 'function') {
      return;
    }
    if (firstFrameId !== undefined) {
      globalThis.cancelAnimationFrame(firstFrameId);
    }
    if (secondFrameId !== undefined) {
      globalThis.cancelAnimationFrame(secondFrameId);
    }
  };
}
