import { useCallback, useEffect, useMemo, useState } from 'react';

import type { IScrollViewRef } from '@onekeyhq/components';

const ITEM_HEIGHT = 48; // Height of each item in the search results

interface IUseSearchPopoverProps {
  scrollViewRef: React.RefObject<IScrollViewRef>;
  totalItems: number;
  onEnterPress?: () => void;
  onEscape?: () => void;
  searchValue?: string;
  displaySearchList: boolean;
  displayHistoryList: boolean;
}

export function useSearchPopover({
  scrollViewRef,
  totalItems,
  onEnterPress,
  onEscape,
  searchValue,
  displaySearchList,
  displayHistoryList,
}: IUseSearchPopoverProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Scroll to selected item
  useEffect(() => {
    if (scrollViewRef.current) {
      const getSelectedItemDistance = () => {
        if (selectedIndex < 4) return 0;
        return selectedIndex * ITEM_HEIGHT;
      };

      const distance = getSelectedItemDistance();
      scrollViewRef.current.scrollTo({
        y: distance,
        animated: true,
      });
    }
  }, [selectedIndex, scrollViewRef]);

  // Reset scroll position when search value changes
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: 0,
      });
    }
  }, [searchValue, scrollViewRef]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();

        if (totalItems === 0) return;

        if (e.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 2 > totalItems ? prev : prev + 1));
        } else if (e.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        onEnterPress?.();
      }

      if (e.key === 'Escape') {
        onEscape?.();
        setIsPopoverOpen(false);
      }
    },
    [totalItems, onEnterPress, onEscape],
  );

  const resetSelectedIndex = () => {
    setSelectedIndex(-1);
  };

  const isPopoverVisible = useMemo(
    () =>
      isPopoverOpen && searchValue && searchValue.length > 0
        ? displaySearchList || displayHistoryList
        : false,
    [isPopoverOpen, searchValue, displaySearchList, displayHistoryList],
  );

  return {
    selectedIndex,
    handleKeyDown,
    resetSelectedIndex,
    isPopoverVisible,
    isPopoverOpen,
    setIsPopoverOpen,
  };
}
