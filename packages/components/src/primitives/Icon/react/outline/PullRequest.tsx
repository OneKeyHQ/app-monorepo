import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPullRequest = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 18.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m11 0a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0M8 5.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m13 13a3.5 3.5 0 1 1-4.5-3.354V6.5h-2.086l.793.793a1 1 0 1 1-1.414 1.414l-2.5-2.5a1 1 0 0 1 0-1.414l2.5-2.5a1 1 0 1 1 1.414 1.414l-.793.793H16.5a2 2 0 0 1 2 2v8.646A3.5 3.5 0 0 1 21 18.5m-11-13a3.5 3.5 0 0 1-2.5 3.354v6.292a3.501 3.501 0 1 1-2 0V8.854A3.5 3.5 0 1 1 10 5.5" />
  </Svg>
);
export default SvgPullRequest;
