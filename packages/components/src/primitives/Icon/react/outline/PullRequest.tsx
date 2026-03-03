import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPullRequest = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 3a2.998 2.998 0 0 1 1 5.825v6.349A2.998 2.998 0 0 1 6 21a3 3 0 0 1-1-5.826V8.825A2.998 2.998 0 0 1 6 3m0 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2M6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m9.414-1-1 1H19v10.174A2.998 2.998 0 0 1 18 21a3 3 0 0 1-1-5.826V7h-2.586l1 1L14 9.414 10.586 6 14 2.586zM18 17a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPullRequest;
