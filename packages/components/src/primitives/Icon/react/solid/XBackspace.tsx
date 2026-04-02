import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXBackspace = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 4v16H7.485l-5.714-8 5.714-8zm-8.75 6.588-2.001-2.002L9.835 10l2 2.002-2 2 1.415 1.414 2-2 2 2 1.415-1.414-2-2 2-2.002-1.413-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgXBackspace;
