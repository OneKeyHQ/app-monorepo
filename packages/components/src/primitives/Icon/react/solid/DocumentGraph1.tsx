import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentGraph1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 10.674A7 7 0 0 0 12.1 22H4V2h16z" />
    <Path
      fillRule="evenodd"
      d="M17 12a5 5 0 1 1 0 10 5 5 0 0 1 0-10m-1 2.17a3.001 3.001 0 1 0 2.294 5.538L16 17.414v-3.243Zm2 2.416 1.708 1.708A3 3 0 0 0 18 14.17z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentGraph1;
