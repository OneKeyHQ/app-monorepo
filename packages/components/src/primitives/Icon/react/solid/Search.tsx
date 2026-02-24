import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8" />
    <Path
      fillRule="evenodd"
      d="M11 3a8 8 0 0 1 6.32 12.905L21.414 20 20 21.414l-4.095-4.094A8 8 0 1 1 11 3m0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSearch;
