import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPullRequest = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 3a3 3 0 0 1 1 5.83v6.34a3.001 3.001 0 1 1-2 0V8.83A3.001 3.001 0 0 1 6 3m9.414 1-1 1H19v10.17a3.001 3.001 0 1 1-2 0V7h-2.586l1 1L14 9.414 10.586 6 14 2.586z" />
  </Svg>
);
export default SvgPullRequest;
