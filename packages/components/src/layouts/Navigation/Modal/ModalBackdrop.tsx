import { Stack } from '../../../primitives';

export default function ModalBackdrop() {
  return (
    <Stack
      testID="APP-Modal-Screen-Backdrop"
      backgroundColor="$bgBackdrop"
      flex={1}
    />
  );
}
