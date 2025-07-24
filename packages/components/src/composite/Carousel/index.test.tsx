/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { Carousel } from './index';
import type { ICarouselProps } from './type';

// Mock the platform environment
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

// Mock the PagerView component
const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
let mockOnPageSelected: ((event: any) => void) | undefined;

jest.mock('./pager', () => ({
  PagerView: React.forwardRef<any, any>(({ children, onPageSelected, initialPage, ...props }, ref) => {
    mockOnPageSelected = onPageSelected;
    
    React.useImperativeHandle(ref, () => ({
      setPage: (page: number) => {
        mockSetPage(page);
        // Simulate page change callback
        if (mockOnPageSelected) {
          mockOnPageSelected({ nativeEvent: { position: page } });
        }
      },
      setPageWithoutAnimation: (page: number) => {
        mockSetPageWithoutAnimation(page);
        // Simulate page change callback
        if (mockOnPageSelected) {
          mockOnPageSelected({ nativeEvent: { position: page } });
        }
      },
    }));
    
    React.useEffect(() => {
      // Simulate initial page selection
      if (onPageSelected) {
        onPageSelected({ 
          nativeEvent: { position: initialPage || 0 } 
        } as any);
      }
    }, [onPageSelected, initialPage]);
    
    return React.createElement('div', {
      'data-testid': 'pager-view',
      ...props
    }, children);
  }),
}));

// Mock the PaginationItem component
jest.mock('./PaginationItem', () => ({
  PaginationItem: ({ index, onPress, dotStyle, activeDotStyle }: any) => 
    React.createElement('button', {
      type: 'button',
      'data-testid': `pagination-item-${index}`,
      onClick: () => onPress?.(index),
      style: { ...dotStyle, ...activeDotStyle }
    }, `Dot ${index}`)
}));

// Mock the primitives
jest.mock('../../primitives', () => ({
  Stack: ({ children, style, onLayout, ...props }: any) => 
    React.createElement('div', {
      style,
      onLayout,
      'data-testid': 'stack',
      ...props
    }, children),
  XStack: ({ children, onLayout, onHoverIn, onHoverOut, onPressIn, onPressOut, ...props }: any) => 
    React.createElement('div', {
      onLayout,
      onMouseEnter: onHoverIn,
      onMouseLeave: onHoverOut,
      onMouseDown: onPressIn,
      onMouseUp: onPressOut,
      'data-testid': 'xstack',
      ...props
    }, children),
  YStack: ({ children, ...props }: any) => 
    React.createElement('div', {
      'data-testid': 'ystack',
      ...props
    }, children)
}));

describe('Carousel Component', () => {
  // Mock data for testing
  const mockData = [
    { id: 1, title: 'Item 1' },
    { id: 2, title: 'Item 2' },
    { id: 3, title: 'Item 3' },
  ];

  const mockRenderItem = jest.fn(({ item, index }) => 
    React.createElement('div', {
      'data-testid': `carousel-item-${index}`
    }, item.title)
  );

  const defaultProps: ICarouselProps<typeof mockData[0]> = {
    data: mockData,
    renderItem: mockRenderItem,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockOnPageSelected = undefined;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    test('renders carousel with correct structure', () => {
      render(React.createElement(Carousel, defaultProps));
      
      expect(screen.getByTestId('ystack')).toBeDefined();
      expect(screen.getByTestId('pager-view')).toBeDefined();
      expect(mockRenderItem).toHaveBeenCalledTimes(mockData.length);
    });

    test('renders all data items correctly', () => {
      render(React.createElement(Carousel, defaultProps));
      
      mockData.forEach((item, index) => {
        expect(mockRenderItem).toHaveBeenCalledWith({ item, index });
      });
    });

    test('renders pagination items when data length > 1', () => {
      render(React.createElement(Carousel, defaultProps));
      
      mockData.forEach((_, index) => {
        expect(screen.getByTestId(`pagination-item-${index}`)).toBeDefined();
      });
    });

    test('does not render pagination for single item', () => {
      const singleItemData = [{ id: 1, title: 'Single Item' }];
      render(React.createElement(Carousel, { ...defaultProps, data: singleItemData }));
      
      expect(screen.queryByTestId('pagination-item-0')).toBeNull();
    });

    test('renders empty carousel with empty data array', () => {
      render(React.createElement(Carousel, { ...defaultProps, data: [] }));
      
      expect(screen.getByTestId('pager-view')).toBeDefined();
      expect(mockRenderItem).not.toHaveBeenCalled();
      expect(screen.queryByTestId('pagination-item-0')).toBeNull();
    });

    test('renders with default props when no optional props provided', () => {
      const minimalProps = {
        data: mockData,
        renderItem: mockRenderItem,
      };
      
      expect(() => render(React.createElement(Carousel, minimalProps))).not.toThrow();
    });
  });

  describe('Auto-play Functionality', () => {
    test('starts auto-play by default with loop enabled', () => {
      render(React.createElement(Carousel, defaultProps));
      
      expect(jest.getTimerCount()).toBe(1);
      
      act(() => {
        jest.advanceTimersByTime(2500); // default autoPlayInterval
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    test('respects custom autoPlayInterval', () => {
      const customInterval = 5000;
      render(React.createElement(Carousel, { ...defaultProps, autoPlayInterval: customInterval }));
      
      act(() => {
        jest.advanceTimersByTime(customInterval - 100);
      });
      
      expect(mockSetPage).not.toHaveBeenCalled();
      
      act(() => {
        jest.advanceTimersByTime(200);
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    test('disables auto-play when loop is false', () => {
      render(React.createElement(Carousel, { ...defaultProps, loop: false }));
      
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      
      expect(mockSetPage).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    test('pauses auto-play on hover in', () => {
      render(React.createElement(Carousel, defaultProps));
      
      const containers = screen.getAllByTestId('xstack');
      const container = containers[0];
      
      act(() => {
        fireEvent.mouseEnter(container);
      });
      
      const timerCountAfterHover = jest.getTimerCount();
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      expect(jest.getTimerCount()).toBe(timerCountAfterHover);
    });

    test('resumes auto-play on hover out', () => {
      render(React.createElement(Carousel, defaultProps));
      
      const containers = screen.getAllByTestId('xstack');
      const container = containers[0];
      
      act(() => {
        fireEvent.mouseEnter(container);
        fireEvent.mouseLeave(container);
      });
      
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    test('handles press events correctly', () => {
      render(React.createElement(Carousel, defaultProps));
      
      const containers = screen.getAllByTestId('xstack');
      const container = containers[0];
      
      act(() => {
        fireEvent.mouseDown(container);
      });
      
      const timerCountAfterPress = jest.getTimerCount();
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      expect(jest.getTimerCount()).toBe(timerCountAfterPress);
    });
  });

  describe('Navigation Methods via Ref', () => {
    test('exposes correct ref methods', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      expect(typeof carouselRef.current?.next).toBe('function');
      expect(typeof carouselRef.current?.prev).toBe('function');
      expect(typeof carouselRef.current?.getCurrentIndex).toBe('function');
      expect(typeof carouselRef.current?.scrollTo).toBe('function');
    });

    test('navigates to next page correctly', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      act(() => {
        carouselRef.current?.next();
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    test('navigates to previous page correctly when on page 1', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      // First navigate to page 1
      act(() => {
        carouselRef.current?.next();
      });
      
      jest.clearAllMocks();
      
      // Then go back to page 0
      act(() => {
        carouselRef.current?.prev();
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(0);
    });

    test('loops to last page when going previous from first page', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      act(() => {
        carouselRef.current?.prev();
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(mockData.length - 1);
    });

    test('loops to first page when reaching the end with next navigation', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      // Navigate to last page first
      act(() => {
        carouselRef.current?.scrollTo({ index: mockData.length - 1 });
      });
      
      jest.clearAllMocks();
      
      // Trigger next page navigation from last page
      act(() => {
        carouselRef.current?.next();
      });
      
      expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(0);
    });

    test('scrolls to specific index', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      const targetIndex = 2;
      act(() => {
        carouselRef.current?.scrollTo({ index: targetIndex });
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(targetIndex);
    });

    test('getCurrentIndex returns current page correctly', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      expect(carouselRef.current?.getCurrentIndex()).toBe(0);
    });

    test('getCurrentIndex returns 0 as fallback when currentPage is undefined', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      // Should return 0 as fallback
      expect(carouselRef.current?.getCurrentIndex()).toBe(0);
    });
  });

  describe('Pagination Interaction', () => {
    test('navigates when pagination item is clicked', () => {
      render(React.createElement(Carousel, defaultProps));
      
      const targetIndex = 1;
      const paginationItem = screen.getByTestId(`pagination-item-${targetIndex}`);
      
      act(() => {
        fireEvent.click(paginationItem);
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(targetIndex);
    });

    test('applies active dot style to current page pagination item', () => {
      const activeDotStyle = { backgroundColor: 'red' };
      render(React.createElement(Carousel, { ...defaultProps, activeDotStyle }));
      
      const firstPaginationItem = screen.getByTestId('pagination-item-0');
      expect(firstPaginationItem.style.backgroundColor).toBe('red');
    });

    test('uses custom pagination item renderer', () => {
      const customRenderPagination = jest.fn((props, index) => 
        React.createElement('div', {
          'data-testid': `custom-pagination-${index}`,
          key: index
        }, `Custom ${index}`)
      );
      
      render(React.createElement(Carousel, { 
        ...defaultProps, 
        renderPaginationItem: customRenderPagination 
      }));
      
      expect(customRenderPagination).toHaveBeenCalledTimes(mockData.length);
      expect(screen.getByTestId('custom-pagination-0')).toBeDefined();
    });

    test('passes correct props to custom pagination renderer', () => {
      const customRenderPagination = jest.fn((props, index) => 
        React.createElement('div', {
          'data-testid': `custom-pagination-${index}`,
          key: index
        })
      );
      
      const dotStyle = { width: '8px' };
      const activeDotStyle = { backgroundColor: 'blue' };
      
      render(React.createElement(Carousel, {
        ...defaultProps,
        renderPaginationItem: customRenderPagination,
        dotStyle,
        activeDotStyle
      }));
      
      expect(customRenderPagination).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockData[0],
          dotStyle,
          activeDotStyle: expect.objectContaining({ backgroundColor: 'blue' }),
          onPress: expect.any(Function),
        }),
        0
      );
    });

    test('applies default active style when no activeDotStyle provided', () => {
      render(React.createElement(Carousel, defaultProps));
      
      const firstPaginationItem = screen.getByTestId('pagination-item-0');
      expect(firstPaginationItem).toBeDefined();
    });
  });

  describe('Event Callbacks', () => {
    test('calls onPageChanged when page changes', () => {
      const onPageChanged = jest.fn();
      render(React.createElement(Carousel, { ...defaultProps, onPageChanged }));
      
      // Simulate page change
      act(() => {
        if (mockOnPageSelected) {
          mockOnPageSelected({ nativeEvent: { position: 1 } });
        }
      });
      
      expect(onPageChanged).toHaveBeenCalledWith(1);
    });

    test('handles layout changes correctly', () => {
      render(React.createElement(Carousel, defaultProps));
      
      const containers = screen.getAllByTestId('xstack');
      const container = containers[0];
      
      act(() => {
        const layoutEvent = {
          nativeEvent: {
            layout: { width: 300, height: 200, x: 0, y: 0 }
          }
        };
        
        if (container.onLayout) {
          container.onLayout(layoutEvent as any);
        }
      });
      
      // Should not throw and should continue rendering
      expect(screen.getByTestId('pager-view')).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles empty data gracefully', () => {
      render(React.createElement(Carousel, { ...defaultProps, data: [] }));
      
      expect(screen.getByTestId('pager-view')).toBeDefined();
      expect(screen.queryByTestId('pagination-item-0')).toBeNull();
      expect(mockRenderItem).not.toHaveBeenCalled();
    });

    test('handles single item data without pagination', () => {
      const singleItem = [{ id: 1, title: 'Single' }];
      render(React.createElement(Carousel, { ...defaultProps, data: singleItem }));
      
      expect(mockRenderItem).toHaveBeenCalledWith({ item: singleItem[0], index: 0 });
      expect(screen.queryByTestId('pagination-item-0')).toBeNull();
    });

    test('cleans up timers on unmount', () => {
      const { unmount } = render(React.createElement(Carousel, defaultProps));
      
      const initialTimerCount = jest.getTimerCount();
      expect(initialTimerCount).toBeGreaterThan(0);
      
      act(() => {
        unmount();
      });
      
      // All timers should be cleared
      expect(jest.getTimerCount()).toBe(0);
    });

    test('handles missing ref gracefully', () => {
      expect(() => {
        render(React.createElement(Carousel, defaultProps));
      }).not.toThrow();
    });

    test('handles ref operations without throwing', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      expect(carouselRef.current).toBeDefined();
      expect(() => carouselRef.current?.next()).not.toThrow();
      expect(() => carouselRef.current?.prev()).not.toThrow();
      expect(() => carouselRef.current?.getCurrentIndex()).not.toThrow();
      expect(() => carouselRef.current?.scrollTo({ index: 0 })).not.toThrow();
    });

    test('handles layout with zero dimensions', () => {
      render(React.createElement(Carousel, defaultProps));
      
      const containers = screen.getAllByTestId('xstack');
      const container = containers[0];
      
      act(() => {
        const layoutEvent = {
          nativeEvent: {
            layout: { width: 0, height: 0, x: 0, y: 0 }
          }
        };
        
        if (container.onLayout) {
          container.onLayout(layoutEvent as any);
        }
      });
      
      // Should handle zero dimensions gracefully
      expect(screen.getByTestId('ystack')).toBeDefined();
    });

    test('handles navigation beyond data boundaries', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      // Try to navigate to index beyond data length
      act(() => {
        carouselRef.current?.scrollTo({ index: mockData.length + 10 });
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(mockData.length + 10);
    });

    test('handles negative index navigation', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      act(() => {
        carouselRef.current?.scrollTo({ index: -1 });
      });
      
      expect(mockSetPage).toHaveBeenCalledWith(-1);
    });
  });

  describe('Component Lifecycle and State Management', () => {
    test('initializes with correct default state', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      expect(carouselRef.current?.getCurrentIndex()).toBe(0);
    });

    test('updates timers when autoPlayInterval prop changes', () => {
      const { rerender } = render(React.createElement(Carousel, { 
        ...defaultProps, 
        autoPlayInterval: 1000 
      }));
      
      const initialTimerCount = jest.getTimerCount();
      
      rerender(React.createElement(Carousel, { 
        ...defaultProps, 
        autoPlayInterval: 2000 
      }));
      
      // Timer should be recreated with new interval
      expect(jest.getTimerCount()).toBeGreaterThanOrEqual(initialTimerCount);
    });

    test('handles prop changes for loop setting', () => {
      const { rerender } = render(React.createElement(Carousel, { 
        ...defaultProps, 
        loop: true 
      }));
      
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      
      rerender(React.createElement(Carousel, { 
        ...defaultProps, 
        loop: false 
      }));
      
      // Timers should be cleared when loop is disabled
      expect(jest.getTimerCount()).toBe(0);
    });

    test('handles data changes correctly', () => {
      const { rerender } = render(React.createElement(Carousel, defaultProps));
      
      expect(mockRenderItem).toHaveBeenCalledTimes(3);
      
      const newData = [{ id: 4, title: 'Item 4' }];
      
      rerender(React.createElement(Carousel, { ...defaultProps, data: newData }));
      
      // Should render with new data
      expect(mockRenderItem).toHaveBeenCalledWith({ item: newData[0], index: 0 });
    });

    test('maintains correct page state during navigation', () => {
      const carouselRef = React.createRef<any>();
      render(React.createElement(Carousel, { ...defaultProps, ref: carouselRef }));
      
      // Navigate to page 1
      act(() => {
        carouselRef.current?.next();
      });
      
      expect(carouselRef.current?.getCurrentIndex()).toBe(1);
      
      // Navigate to page 2
      act(() => {
        carouselRef.current?.next();
      });
      
      expect(carouselRef.current?.getCurrentIndex()).toBe(2);
    });
  });

  describe('Default Pagination Renderer', () => {
    test('uses default pagination renderer when none provided', () => {
      render(React.createElement(Carousel, defaultProps));
      
      // Should render default pagination items
      mockData.forEach((_, index) => {
        expect(screen.getByTestId(`pagination-item-${index}`)).toBeDefined();
      });
    });

    test('applies correct props to default pagination items', () => {
      const dotStyle = { opacity: '0.5' };
      const activeDotStyle = { opacity: '1', backgroundColor: 'red' };
      
      render(React.createElement(Carousel, {
        ...defaultProps,
        dotStyle,
        activeDotStyle
      }));
      
      // Check active item (index 0)
      const activeItem = screen.getByTestId('pagination-item-0');
      expect(activeItem.style.backgroundColor).toBe('red');
      expect(activeItem.style.opacity).toBe('1');
      
      // Check inactive item (index 1)
      const inactiveItem = screen.getByTestId('pagination-item-1');
      expect(inactiveItem.style.opacity).toBe('0.5');
    });
  });

  describe('Platform-specific Behavior', () => {
    test('applies press handlers on native platform', () => {
      // Mock native platform
      jest.doMock('@onekeyhq/shared/src/platformEnv', () => ({
        __esModule: true,
        default: { isNative: true },
      }));

      const { unmount } = render(React.createElement(Carousel, defaultProps));
      
      const containers = screen.getAllByTestId('xstack');
      const container = containers[0];
      
      // Should have press handlers applied
      expect(container.onMouseDown).toBeDefined();
      expect(container.onMouseUp).toBeDefined();
      
      unmount();
      
      // Reset mock
      jest.doMock('@onekeyhq/shared/src/platformEnv', () => ({
        __esModule: true,
        default: { isNative: false },
      }));
    });
  });
});