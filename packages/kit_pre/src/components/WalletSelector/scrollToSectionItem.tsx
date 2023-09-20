import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

export function scrollToSectionItem<T>({
  sectionListRef,
  sectionData,
  isScrollToItem,
  onScrolled,
  skipScrollIndex,
  delay,
}: {
  sectionListRef: any;
  sectionData: Array<{ data: T[] }>;
  isScrollToItem: (item?: T, section?: any) => boolean;
  onScrolled: () => void;
  skipScrollIndex: number;
  delay: number;
}) {
  const findScrollToIndex = () => {
    let itemCounts = 0;
    let sectionIndex = 0;
    let itemIndex = 1;

    for (let i = 0; i < sectionData.length; i += 1) {
      const section = sectionData[i];
      if (!section.data.length && isScrollToItem(undefined, section)) {
        sectionIndex = i;
        return {
          itemIndex: 1,
          sectionIndex,
          itemCounts,
        };
      }
      for (let j = 0; j < section.data.length; j += 1) {
        const item = section.data[j];
        itemCounts += 1;
        if (isScrollToItem(item, section)) {
          sectionIndex = i;
          itemIndex = j + 1;
          return {
            itemIndex,
            sectionIndex,
            itemCounts,
          };
        }
      }
    }
    return {
      itemIndex,
      sectionIndex,
      itemCounts,
    };
  };
  setTimeout(() => {
    try {
      const { sectionIndex, itemIndex, itemCounts } = findScrollToIndex();

      if (itemCounts <= skipScrollIndex) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      sectionListRef?.current?.scrollToLocation?.({
        animated: true,
        sectionIndex, // starts from 0
        itemIndex, // starts from 1
      });
      onScrolled();
    } catch (error) {
      debugLogger.common.error(error);
    }
  }, delay);
}
