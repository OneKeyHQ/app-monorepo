import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotebook3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 13H9v-2h4zm2-4H9V7h6z" />
    <Path
      fillRule="evenodd"
      d="M20.5 21.5h-17V17h-1v-2h1v-2h-1v-2h1V9h-1V7h1V2.5h17zM5.5 7h1v2h-1v2h1v2h-1v2h1v2h-1v2.5h13v-15h-13z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook3;
