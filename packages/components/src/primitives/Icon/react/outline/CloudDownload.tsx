import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudDownload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 4a7 7 0 0 1 6.939 6.089A5 5 0 0 1 18 20h-2v-2h2a3 3 0 0 0 0-6h-1v-1a5 5 0 0 0-9.729-1.629l-.2.583-.612.082A4.001 4.001 0 0 0 7 18h1v2H7A6 6 0 0 1 5.598 8.165 7 7 0 0 1 12 4" />
    <Path d="m13 16.086 1.5-1.5L15.914 16 12 19.914 8.086 16 9.5 14.586l1.5 1.5V11h2z" />
  </Svg>
);
export default SvgCloudDownload;
