import { SectionPressItem } from './SectionPressItem';

export function CrashDevSettings() {
  return (
    <>
      <SectionPressItem
        title="Crash Test with Private Key"
        onPress={() => {
          throw new Error(
            'Test error with private key: 5KQNWfsMwLXLCh3zdpCQjLmvY8dWt3HqZjc9YJyuXUKFzZeK8Ld',
          );
        }}
      />
      <SectionPressItem
        title="Crash Test with Mnemonic"
        onPress={() => {
          throw new Error(
            'Test error with mnemonic: abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual',
          );
        }}
      />
    </>
  );
}
