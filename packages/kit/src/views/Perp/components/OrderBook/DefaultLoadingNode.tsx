import { StyleSheet, Text, View } from 'react-native';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    color: 'rgb(132, 142, 156)',
  },
});

export function DefaultLoadingNode() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingLabel}>Loading...</Text>
    </View>
  );
}
