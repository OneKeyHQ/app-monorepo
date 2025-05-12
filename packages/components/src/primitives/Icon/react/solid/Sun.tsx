import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSun = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13 2a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0zm0 19a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0zm6.777-16.777a1 1 0 0 1 0 1.414l-.71.71a1 1 0 1 1-1.414-1.414l.71-.71a1 1 0 0 1 1.414 0M6.347 19.067a1 1 0 1 0-1.414-1.414l-.71.71a1 1 0 1 0 1.414 1.414zM20 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1M2 11a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2zm15.653 6.653a1 1 0 0 1 1.414 0l.71.71a1 1 0 0 1-1.414 1.414l-.71-.71a1 1 0 0 1 0-1.414M5.637 4.223a1 1 0 1 0-1.414 1.414l.71.71a1 1 0 0 0 1.414-1.414zm2.12 3.534a6 6 0 1 1 8.486 8.486 6 6 0 0 1-8.486-8.486"
    />
  </Svg>
);
export default SvgSun;
