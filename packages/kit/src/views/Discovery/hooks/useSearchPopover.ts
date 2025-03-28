import { useCallback, useEffect, useMemo, useState } from 'react';

import type { IScrollViewRef } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EDiscoveryModalRoutes } from '@onekeyhq/shared/src/routes/discovery';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';

import { useSearchPopoverUIFeatureFlag } from './useSearchPopoverFeatureFlag';

const ITEM_HEIGHT = 48; // Height of each item in the search results

interface IUseSearchPopoverProps {
  refreshLocalData: () => void;
  scrollViewRef: React.RefObject<IScrollViewRef>;
  totalItems: number;
  onEnterPress?: () => void;
  onEscape?: () => void;
  searchValue?: string;
  displaySearchList: boolean;
  displayHistoryList: boolean;
}

export function useSearchPopover({
  refreshLocalData,
  scrollViewRef,
  totalItems,
  onEnterPress,
  onEscape,
  searchValue,
  displaySearchList,
  displayHistoryList,
}: IUseSearchPopoverProps) {
  const searchPopoverUIFeatureFlag = useSearchPopoverUIFeatureFlag();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const navigation = useAppNavigation();

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

  const isPopoverVisible = useMemo(
    () =>
      isPopoverOpen && searchValue && searchValue.length > 0
        ? displaySearchList || displayHistoryList
        : false,
    [isPopoverOpen, searchValue, displaySearchList, displayHistoryList],
  );

  const resetSelectedIndex = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  useEffect(() => {
    resetSelectedIndex();

    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }, [isPopoverOpen, resetSelectedIndex, scrollViewRef, searchValue]);

  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      setIsPopoverOpen(false);
    }, 200);
  }, [setIsPopoverOpen]);

  useEffect(() => {
    void refreshLocalData?.();
  }, [refreshLocalData, isPopoverOpen]);

  const handleSearchBarPress = useCallback(() => {
    // only on mobile
    if (!searchPopoverUIFeatureFlag) {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
      });
    }
  }, [navigation, searchPopoverUIFeatureFlag]);

  return {
    handleSearchBarPress,
    selectedIndex,
    handleKeyDown,
    resetSelectedIndex,
    isPopoverVisible,
    isPopoverOpen,
    setIsPopoverOpen,
    handleInputBlur,
  };
}
