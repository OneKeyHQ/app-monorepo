import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBacktrack = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 4v16H7.485L1.77 12l5.714-8h14.514Zm-8.75 6.588-2.002-2.002L9.835 10l2.001 2.002-2 2 1.414 1.414 2-2 2 2 1.416-1.414-2-2 2-2.002-1.413-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBacktrack;
