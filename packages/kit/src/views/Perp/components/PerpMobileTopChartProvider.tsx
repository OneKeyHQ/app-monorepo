import {
  type ReactNode,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { YStack } from '@onekeyhq/components';

import { PerpMobileTopChartPanel } from './PerpMobileChartPanel';
import { PerpTickerBar } from './TickerBar/PerpTickerBar';

import type { LayoutChangeEvent } from 'react-native';

interface IPerpMobileTopChartContextValue {
  isEnabled: boolean;
  isExpanded: boolean;
  onClose: () => void;
  onToggle: () => void;
}

const PerpMobileTopChartContext =
  createContext<IPerpMobileTopChartContextValue>({
    isEnabled: false,
    isExpanded: false,
    onClose: () => undefined,
    onToggle: () => undefined,
  });

export const PerpMobileTopChartProvider = memo(
  ({ children, isEnabled }: { children: ReactNode; isEnabled: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleToggle = useCallback(() => {
      setIsExpanded((currentValue) => !currentValue);
    }, []);
    const handleClose = useCallback(() => {
      setIsExpanded(false);
    }, []);

    useEffect(() => {
      if (!isEnabled) {
        setIsExpanded(false);
      }
    }, [isEnabled]);

    const value = useMemo(
      () => ({
        isEnabled,
        isExpanded,
        onClose: handleClose,
        onToggle: handleToggle,
      }),
      [handleClose, handleToggle, isEnabled, isExpanded],
    );

    return (
      <PerpMobileTopChartContext.Provider value={value}>
        {children}
      </PerpMobileTopChartContext.Provider>
    );
  },
);

PerpMobileTopChartProvider.displayName = 'PerpMobileTopChartProvider';

export const PerpMobileTopChartTicker = memo(
  ({ onLayout }: { onLayout: (event: LayoutChangeEvent) => void }) => {
    const { isEnabled, isExpanded, onToggle } = useContext(
      PerpMobileTopChartContext,
    );

    return (
      <YStack onLayout={onLayout}>
        <PerpTickerBar
          isTopChartExpanded={isExpanded}
          onToggleTopChart={onToggle}
          showTopChartToggle={isEnabled}
        />
      </YStack>
    );
  },
);

PerpMobileTopChartTicker.displayName = 'PerpMobileTopChartTicker';

export const PerpMobileTopChartContent = memo(() => {
  const { isEnabled, isExpanded, onClose } = useContext(
    PerpMobileTopChartContext,
  );

  return isEnabled ? (
    <PerpMobileTopChartPanel isExpanded={isExpanded} onClose={onClose} />
  ) : null;
});

PerpMobileTopChartContent.displayName = 'PerpMobileTopChartContent';
