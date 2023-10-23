import { type PropsWithChildren, isValidElement } from 'react';

import { MotiView } from 'moti';
import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { StyleSheet } from 'react-native';

import useTheme from '../Provider/hooks/useTheme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  padded: {
    padding: 16,
  },
});

const Spacer = ({ height = 16 } : { height: number }) => <MotiView style={{ height }} />;

export function Skeleton() {
  const { themeVariant } = useTheme();
  return (
    <MotiView
      transition={{
        type: 'timing',
      }}
      style={[styles.container, styles.padded]}
      animate={{
        backgroundColor: themeVariant === 'dark' ? '#000000' : '#ffffff',
      }}
    >
      <MotiSkeleton
        colorMode={themeVariant}
        radius="round"
        height={75}
        width={75}
      />
      <Spacer />
      <MotiSkeleton colorMode={themeVariant} width={250} />
      <Spacer height={8} />
      <MotiSkeleton colorMode={themeVariant} width="100%" />
      <Spacer height={8} />
      <MotiSkeleton colorMode={themeVariant} width="100%" />
    </MotiView>
  );
}
