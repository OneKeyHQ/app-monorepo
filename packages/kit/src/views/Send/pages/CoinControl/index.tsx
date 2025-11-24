import { memo, useCallback, useMemo, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Icon,
  ListView,
  Page,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

// UTXO data type definition
interface IUTXO {
  txid: string;
  vout: number;
  value: string; // BTC amount
  address: string;
  timestamp: number;
}

// Sort type enum
enum ESortType {
  NewestFirst = 'newestFirst',
  OldestFirst = 'oldestFirst',
  SmallestFirst = 'smallestFirst',
  LargestFirst = 'largestFirst',
}

// Generate mock data (300 items for performance testing)
const generateMockUTXOs = (count: number): IUTXO[] => {
  const addresses = [
    'bc1ph7ka...Im4nlc',
    'bc1qxy2k...3dchkr',
    'bc1q9z8x...7yw4mn',
    '3J98t1W...Qb5t8h',
    'bc1pxww...kl9mnh',
  ];

  return Array.from({ length: count }, (_, index) => ({
    txid: `mock_txid_${index}`,
    vout: index,
    value: (Math.random() * 0.001).toFixed(7),
    address: addresses[index % addresses.length],
    timestamp: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random timestamp within 30 days
  }));
};

// ListItem component - optimized with memo for performance
const UTXOListItem = memo(
  ({
    item,
    index,
    isSelected,
    onToggle,
  }: {
    item: IUTXO;
    index: number;
    isSelected: boolean;
    onToggle: (txid: string) => void;
  }) => {
    const handlePress = useCallback(() => {
      onToggle(item.txid);
    }, [item.txid, onToggle]);

    const formattedDate = useMemo(() => {
      const date = new Date(item.timestamp);
      const options: Intl.DateTimeFormatOptions = {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      };
      const formatted = date.toLocaleString('en-US', options);
      // Format: "October 21, 2025 at 11:21"
      return formatted
        .replace(',', ' at')
        .replace(' at ', ', ')
        .replace(',', ' at');
    }, [item.timestamp]);

    return (
      <XStack
        px="$5"
        py="$1"
        gap="$3"
        ai="center"
        onPress={handlePress}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
      >
        {/* Left: Checkbox + Index number */}
        <XStack ai="center" gap="$2" w={80}>
          <Checkbox value={isSelected} onChange={handlePress} />
          <SizableText size="$bodyMd" color="$text">
            {index + 1}
          </SizableText>
        </XStack>

        {/* Middle: Amount */}
        <SizableText
          size="$bodyMd"
          color="$text"
          textAlign="right"
          minWidth={120}
        >
          {item.value} BTC
        </SizableText>

        {/* Right: Address + Timestamp */}
        <YStack flex={1} ai="flex-end">
          <SizableText size="$bodyMd" color="$text">
            {item.address}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {formattedDate}
          </SizableText>
        </YStack>
      </XStack>
    );
  },
);

UTXOListItem.displayName = 'UTXOListItem';

function CoinControlPage() {
  // Mock data
  const mockData = useMemo(() => generateMockUTXOs(300), []);

  // State management
  const [selectedUTXOs, setSelectedUTXOs] = useState<Set<string>>(new Set());
  const [sortType, setSortType] = useState<ESortType>(ESortType.NewestFirst);

  // Sorted data based on current sort type
  const sortedData = useMemo(() => {
    const data = [...mockData];
    switch (sortType) {
      case ESortType.NewestFirst:
        // Sort by timestamp descending (newest first)
        return data.sort((a, b) => b.timestamp - a.timestamp);
      case ESortType.OldestFirst:
        // Sort by timestamp ascending (oldest first)
        return data.sort((a, b) => a.timestamp - b.timestamp);
      case ESortType.LargestFirst:
        // Sort by amount descending (largest first)
        return data.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
      case ESortType.SmallestFirst:
        // Sort by amount ascending (smallest first)
        return data.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
      default:
        return data;
    }
  }, [mockData, sortType]);

  // Check if all items are selected
  const isAllSelected = useMemo(
    () => selectedUTXOs.size === mockData.length && mockData.length > 0,
    [selectedUTXOs.size, mockData.length],
  );

  // Check if some (but not all) items are selected
  const isIndeterminate = useMemo(
    () => selectedUTXOs.size > 0 && selectedUTXOs.size < mockData.length,
    [selectedUTXOs.size, mockData.length],
  );

  // Checkbox value state
  const checkboxValue: ICheckedState = useMemo(() => {
    if (isAllSelected) return true;
    if (isIndeterminate) return 'indeterminate';
    return false;
  }, [isAllSelected, isIndeterminate]);

  // Calculate total amount of selected UTXOs
  const totalAmount = useMemo(() => {
    let sum = 0;
    sortedData.forEach((utxo) => {
      if (selectedUTXOs.has(utxo.txid)) {
        sum += parseFloat(utxo.value);
      }
    });
    return sum.toFixed(7);
  }, [selectedUTXOs, sortedData]);

  // Toggle single UTXO selection
  const handleToggleUTXO = useCallback((txid: string) => {
    setSelectedUTXOs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(txid)) {
        newSet.delete(txid);
      } else {
        newSet.add(txid);
      }
      return newSet;
    });
  }, []);

  // Select all / Deselect all
  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedUTXOs(new Set());
    } else {
      setSelectedUTXOs(new Set(mockData.map((utxo) => utxo.txid)));
    }
  }, [isAllSelected, mockData]);

  // Done button handler
  const handleDone = useCallback(() => {
    console.log('Selected UTXOs:', Array.from(selectedUTXOs));
    console.log('Total amount:', totalAmount, 'BTC');
    // TODO: Pass selected UTXOs to parent component
  }, [selectedUTXOs, totalAmount]);

  // Sort options
  const sortOptions = useMemo(
    () => [
      {
        label: 'Newest first',
        value: ESortType.NewestFirst,
      },
      {
        label: 'Oldest first',
        value: ESortType.OldestFirst,
      },
      {
        label: 'Largest first',
        value: ESortType.LargestFirst,
      },
      {
        label: 'Smallest first',
        value: ESortType.SmallestFirst,
      },
    ],
    [],
  );

  // Render list item
  const renderItem = useCallback(
    ({ item, index }: { item: IUTXO; index: number }) => (
      <UTXOListItem
        item={item}
        index={index}
        isSelected={selectedUTXOs.has(item.txid)}
        onToggle={handleToggleUTXO}
      />
    ),
    [selectedUTXOs, handleToggleUTXO],
  );

  // Key extractor for list items
  const keyExtractor = useCallback((item: IUTXO) => item.txid, []);

  return (
    <Page>
      <Page.Header title="Coin control" />
      <Page.Body>
        <ListView
          estimatedItemSize={60}
          data={sortedData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
        />
      </Page.Body>
      <Page.Footer>
        <XStack px="$5" py="$5" gap="$3" ai="center" bg="$bgApp">
          {/* Select all checkbox */}
          <Checkbox value={checkboxValue} onChange={handleSelectAll} />

          {/* Selected info */}
          <YStack flex={1} jc="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {selectedUTXOs.size} selected
            </SizableText>
            <SizableText size="$bodyMd" fontWeight="600" color="$text">
              {totalAmount} BTC
            </SizableText>
          </YStack>

          {/* Sort selector */}
          <Select
            title="Sort by"
            value={sortType}
            onChange={setSortType}
            items={sortOptions}
            renderTrigger={({ label, onPress }) => (
              <XStack
                borderWidth="$0.5"
                borderColor="$borderStrong"
                borderRadius="$2"
                px="$3"
                py="$2"
                onPress={onPress}
                ai="center"
                minWidth={128}
                gap="$2"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
              >
                <SizableText size="$bodyMd" fontWeight="500" flexShrink={1}>
                  {label}
                </SizableText>
                <Icon
                  name="ChevronTopSmallOutline"
                  size="$6"
                  color="$icon"
                  flexShrink={0}
                />
              </XStack>
            )}
          />

          {/* Done button */}
          <Button variant="primary" onPress={handleDone}>
            Done
          </Button>
        </XStack>
      </Page.Footer>
    </Page>
  );
}

export default CoinControlPage;
