import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrokenLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 1a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V2a1 1 0 0 1 1-1m4.086 1.5a2 2 0 0 1 2.828 0L21.5 8.086a2 2 0 0 1 0 2.828l-2.793 2.793a1 1 0 0 1-1.414-1.414L20.086 9.5 14.5 3.914l-2.793 2.793a1 1 0 1 1-1.414-1.414zm-10.293.293a1 1 0 0 1 1.414 0l1 1a1 1 0 0 1-1.414 1.414l-1-1a1 1 0 0 1 0-1.414M1 9a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H2a1 1 0 0 1-1-1m5.707 1.293a1 1 0 0 1 0 1.414L3.914 14.5 9.5 20.086l2.793-2.793a1 1 0 0 1 1.414 1.414L10.914 21.5a2 2 0 0 1-2.828 0L2.5 15.914a2 2 0 0 1 0-2.828l2.793-2.793a1 1 0 0 1 1.414 0M20 15a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1m-1.207 3.793a1 1 0 0 1 1.414 0l1 1a1 1 0 0 1-1.414 1.414l-1-1a1 1 0 0 1 0-1.414M15 20a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrokenLink;
