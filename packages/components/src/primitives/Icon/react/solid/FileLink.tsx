import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2H7a3 3 0 0 0-3 3v4.341A6 6 0 0 1 12 15v3a5.98 5.98 0 0 1-1.528 4H17a3 3 0 0 0 3-3v-9h-5a3 3 0 0 1-3-3z"
    />
    <Path
      fill="currentColor"
      d="M19.414 8 14 2.586V7a1 1 0 0 0 1 1zM4 15a2 2 0 1 1 4 0 1 1 0 1 0 2 0 4 4 0 0 0-8 0 1 1 0 1 0 2 0"
    />
    <Path fill="currentColor" d="M7 16a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0z" />
    <Path
      fill="currentColor"
      d="M4 18a1 1 0 1 0-2 0 4 4 0 0 0 8 0 1 1 0 1 0-2 0 2 2 0 1 1-4 0"
    />
  </Svg>
);
export default SvgFileLink;
