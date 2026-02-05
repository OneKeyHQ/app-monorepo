import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInvite = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 2a2 2 0 0 1 2 2v6.386c1.064-.002 2 .86 2 2.002V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6.612c0-1.142.936-2.004 2-2.002V4a2 2 0 0 1 2-2zM6 10.946l6 2 6-2V4H6zM14 7a1 1 0 1 1 0 2h-4a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgInvite;
