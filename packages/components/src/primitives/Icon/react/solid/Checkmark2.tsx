import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.632 3.037a1.5 1.5 0 0 1 .331 2.095l-11.456 15.75a1.5 1.5 0 0 1-2.14.297l-6.044-4.75a1.5 1.5 0 0 1 1.854-2.358l4.82 3.788 10.54-14.491a1.5 1.5 0 0 1 2.095-.331"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckmark2;
