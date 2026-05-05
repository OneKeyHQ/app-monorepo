import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklistBoxNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 13a4 4 0 0 1 4 4v4h-2.27a1.998 1.998 0 0 1-3.46 0H14v-4a4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2v2h4v-2a2 2 0 0 0-2-2"
      clipRule="evenodd"
    />
    <Path d="M21 11h-2V5H5v14h7v2H3V3h18z" />
    <Path d="M11.94 13.554 8.9 17.605l-2.744-1.829 1.11-1.664 1.169.78 1.905-2.538zm0-6.002L8.9 11.605l-2.744-1.83 1.11-1.664 1.169.78 1.905-2.538zM17.058 10h-4V8h4z" />
  </Svg>
);
export default SvgChecklistBoxNotification;
