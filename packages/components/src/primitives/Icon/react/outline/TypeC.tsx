import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTypeC = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M6 11a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 6a6 6 0 1 0 0 12h12a6 6 0 0 0 0-12zm-4 6a4 4 0 0 1 4-4h12a4 4 0 0 1 0 8H6a4 4 0 0 1-4-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTypeC;
