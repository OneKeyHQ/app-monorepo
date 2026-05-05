import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.204 11H16v11H8V11H2.796L12 .481zm-14-2H10v11h4V9h2.796L12 3.519z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowPathUp;
