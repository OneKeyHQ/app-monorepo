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
      d="M16.5 13a4.5 4.5 0 0 1 3.82 6.876l1.594 1.648-1.437 1.391-1.566-1.618A4.5 4.5 0 1 1 16.5 13m0 2a2.5 2.5 0 1 0 1.771 4.263l.019-.018A2.5 2.5 0 0 0 16.5 15"
      clipRule="evenodd"
    />
    <Path d="M20 11h-2V4H6v16h4.5v2H4V2h16z" />
  </Svg>
);
export default SvgDocumentSearch2;
