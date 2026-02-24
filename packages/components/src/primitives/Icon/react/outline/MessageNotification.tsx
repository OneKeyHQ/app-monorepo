import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.002 5h-9v12.036h5.377L12 19.233l2.377-1.967.278-.23h5.347v-5.018h2v7.018h-6.627l-3.38 2.802-3.343-2.802h-6.65V3h11z" />
    <Path
      fillRule="evenodd"
      d="M19 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageNotification;
