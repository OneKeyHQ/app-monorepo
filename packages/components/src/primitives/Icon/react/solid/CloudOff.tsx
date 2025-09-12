import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M22.102 17.86a5.002 5.002 0 0 0-3.161-7.771A7 7 0 0 0 8.943 4.7l13.16 13.159ZM3.707 2.293a1 1 0 0 0-1.414 1.414l3.699 3.7a7 7 0 0 0-.394.758A6.002 6.002 0 0 0 7 20h11q.281 0 .555-.03l1.738 1.737a1 1 0 0 0 1.414-1.414L19.615 18.2l-.01-.01L7.995 6.58l-.01-.01-4.277-4.277Z"
    />
  </Svg>
);
export default SvgCloudOff;
