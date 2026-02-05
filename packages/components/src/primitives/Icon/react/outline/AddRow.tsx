import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddRow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.5 13.5a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M19.5 2.5a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-17v5h7a1 1 0 1 1 0 2h-7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2zm-16 7h16v-5h-16z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddRow;
