import { useState } from 'react';

import { Button, SizableText, Stack, XStack } from '@onekeyhq/components';
import {
  OrderBook,
  OrderPairBook,
} from '@onekeyhq/kit/src/views/Perp/components/OrderBook';
import type { IOBLevel } from '@onekeyhq/kit/src/views/Perp/components/OrderBook/types';

import { Layout } from './utils/Layout';

// Sample order book data
const generateSampleData = (basePrice: number, spread = 0.5) => {
  const bids: IOBLevel[] = [];
  const asks: IOBLevel[] = [];

  // Generate 20 levels on each side
  for (let i = 0; i < 20; i += 1) {
    const bidPrice = basePrice - (i + 1) * spread;
    const askPrice = basePrice + (i + 1) * spread;
    const size = Math.random() * 100 + 10; // Random size between 10-110

    bids.push({
      price: bidPrice,
      size,
      cumSize: 0, // Will be calculated by the component
    });

    asks.push({
      price: askPrice,
      size,
      cumSize: 0, // Will be calculated by the component
    });
  }

  return { bids, asks };
};

const OrderBookDemo = () => {
  const [basePrice, setBasePrice] = useState(500_000);
  const [spread, setSpread] = useState(0.5);

  const { bids, asks } = generateSampleData(basePrice, spread);

  return (
    <Stack gap="$4">
      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          OrderBook Component Demo
        </SizableText>

        <SizableText size="$bodySm" color="$textSubdued">
          This component displays a real-time order book with bid/ask levels,
          depth visualization, and aggregation controls.
        </SizableText>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyMd" fontWeight="500">
          Controls
        </SizableText>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            variant="secondary"
            size="small"
            onPress={() => setBasePrice(50_000)}
          >
            BTC Price ($50k)
          </Button>
          <Button
            variant="secondary"
            size="small"
            onPress={() => setBasePrice(3000)}
          >
            ETH Price ($3k)
          </Button>
          <Button
            variant="secondary"
            size="small"
            onPress={() => setBasePrice(1)}
          >
            Test Price ($1)
          </Button>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            variant="secondary"
            size="small"
            onPress={() => setSpread(0.1)}
          >
            Tight Spread (0.1)
          </Button>
          <Button
            variant="secondary"
            size="small"
            onPress={() => setSpread(0.5)}
          >
            Normal Spread (0.5)
          </Button>
          <Button variant="secondary" size="small" onPress={() => setSpread(2)}>
            Wide Spread (2)
          </Button>
        </XStack>
      </Stack>

      <Stack gap="$2">
        <SizableText size="$bodyMd" fontWeight="500">
          Order Book
        </SizableText>

        <Stack p="$2">
          <OrderBook bids={bids} asks={asks} maxLevelsPerSide={15} />
        </Stack>
        <Stack p="$2">
          <OrderBook
            horizontal={false}
            bids={bids}
            asks={asks}
            maxLevelsPerSide={15}
          />
        </Stack>
      </Stack>
      <Stack p="$2">
        <OrderPairBook bids={bids} asks={asks} maxLevelsPerSide={15} />
      </Stack>

      <Stack gap="$2">
        <SizableText size="$bodyMd" fontWeight="500">
          Features Demonstrated
        </SizableText>

        <Stack gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            • Real-time bid/ask level display
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            • Depth visualization with colored bars
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            • Aggregation controls for tick size adjustment
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            • Mid-price calculation and display
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            • Customizable colors and formatting
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            • Responsive layout with proper scrolling
          </SizableText>
        </Stack>
      </Stack>
    </Stack>
  );
};

const OrderBookGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="OrderBookGallery"
    elements={[
      {
        title: 'OrderBook Component',
        element: <OrderBookDemo />,
      },
    ]}
  />
);

export default OrderBookGallery;
