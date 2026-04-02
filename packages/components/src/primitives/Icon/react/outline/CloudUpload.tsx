import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudUpload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 4a7 7 0 0 1 6.939 6.089A5 5 0 0 1 18 20h-3v-2h3a3 3 0 0 0 0-6h-1v-1a5 5 0 0 0-9.729-1.629l-.2.583-.612.082A4.001 4.001 0 0 0 7 18h2v2H7A6 6 0 0 1 5.598 8.165 7 7 0 0 1 12 4" />
    <Path d="M15.914 14.5 14.5 15.914l-1.5-1.5V20h-2v-5.586l-1.5 1.5L8.086 14.5 12 10.586z" />
  </Svg>
);
export default SvgCloudUpload;
