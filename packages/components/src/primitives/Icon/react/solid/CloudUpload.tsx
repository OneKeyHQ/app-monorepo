import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudUpload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 4a7 7 0 0 1 6.941 6.089A5.001 5.001 0 0 1 18 20h-5v-5.586l1.5 1.5 1.414-1.414L12 10.586 8.086 14.5 9.5 15.914l1.5-1.5V20H7A6 6 0 0 1 5.599 8.165 7 7 0 0 1 12 4" />
  </Svg>
);
export default SvgCloudUpload;
