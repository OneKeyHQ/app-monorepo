import { openPicker } from 'react-native-image-crop-picker';
import { withStaticProperties } from 'tamagui';

function BasicImageCrop() {
  return null;
}

export const ImageCrop = withStaticProperties(BasicImageCrop, {
  openPicker,
});
