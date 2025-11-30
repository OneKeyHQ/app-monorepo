/**
 * Example usage of DualScreenInfo module
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

import DualScreenInfo, { useDualScreenInfo } from './index';

import type { Rect } from './index';

/**
 * Example component using the useDualScreenInfo hook
 */
export function DualScreenExample() {
  const {
    isDualScreenDevice,
    isSpanning,
    windowRects,
    hingeBounds,
    isLoading,
    refresh,
  } = useDualScreenInfo();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading dual screen info...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dual Screen Info</Text>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Is Dual-Screen Device:</Text>
        <Text style={styles.value}>{isDualScreenDevice ? 'Yes' : 'No'}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Is Spanning:</Text>
        <Text style={styles.value}>{isSpanning ? 'Yes' : 'No'}</Text>
      </View>

      {windowRects.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Window Rects:</Text>
          {windowRects.map((rect: Rect, index: number) => (
            <Text key={index} style={styles.rectText}>
              Screen {index + 1}: x={rect.x}, y={rect.y}, width={rect.width},
              height={rect.height}
            </Text>
          ))}
        </View>
      )}

      {hingeBounds && (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Hinge Bounds:</Text>
          <Text style={styles.rectText}>
            x={hingeBounds.x}, y={hingeBounds.y}, width={hingeBounds.width},
            height={hingeBounds.height}
          </Text>
        </View>
      )}

      <Button title="Refresh" onPress={refresh} />
    </View>
  );
}

/**
 * Example component using direct API calls
 */
export function DualScreenManualExample() {
  const [isDualScreen, setIsDualScreen] = useState(false);
  const [isSpanning, setIsSpanning] = useState(false);
  const [windowRects, setWindowRects] = useState<Rect[]>([]);

  useEffect(() => {
    // Initial checks
    void DualScreenInfo.isDualScreenDevice().then(setIsDualScreen);
    void DualScreenInfo.isSpanning().then(setIsSpanning);
    void DualScreenInfo.getWindowRects().then(setWindowRects);

    // Listen to spanning changes
    const subscription = DualScreenInfo.addSpanningListener((event) => {
      setIsSpanning(event.isSpanning);
      void DualScreenInfo.getWindowRects().then(setWindowRects);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dual Screen Manual Example</Text>
      <Text>Is Dual-Screen: {isDualScreen ? 'Yes' : 'No'}</Text>
      <Text>Is Spanning: {isSpanning ? 'Yes' : 'No'}</Text>
      <Text>Window Rects: {windowRects.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
    marginRight: 8,
  },
  value: {
    color: '#666',
  },
  section: {
    marginTop: 16,
    marginBottom: 16,
  },
  rectText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    marginBottom: 4,
  },
});

