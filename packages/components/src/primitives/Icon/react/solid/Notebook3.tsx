import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotebook3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.5 21.5h-17V17h-1v-2h1v-2h-1v-2h1V9h-1V7h1V2.5h17zM9 11v2h4v-2zm0-4v2h6V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook3;
