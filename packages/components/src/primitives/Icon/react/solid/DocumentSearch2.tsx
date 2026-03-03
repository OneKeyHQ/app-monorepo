import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentSearch2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.5 13a4.5 4.5 0 0 1 3.821 6.877l1.593 1.646-1.437 1.391-1.563-1.615A4.5 4.5 0 1 1 16.5 13m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
    <Path d="M20 12.021A6.5 6.5 0 0 0 11.81 22H4V2h16z" />
  </Svg>
);
export default SvgDocumentSearch2;
