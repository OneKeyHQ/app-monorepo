import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentGraph2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 10h-2V4H6v16h4.75v2H4V2h16z" />
    <Path
      fillRule="evenodd"
      d="M17 12a5 5 0 1 1 0 10 5 5 0 0 1 0-10m-1 2.174a2.999 2.999 0 1 0 2.291 5.531L16 17.415zm2 2.412 1.705 1.705C19.892 17.9 20 17.463 20 17a3 3 0 0 0-2-2.826z"
      clipRule="evenodd"
    />
    <Path d="M12 12H8v-2h4zm4-4H8V6h8z" />
  </Svg>
);
export default SvgDocumentGraph2;
