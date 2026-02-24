import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDrink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m17.693 2.759-4.692 1.043V6h6.068l-1.133 17H6.066L4.931 6H11V2.198L17.26.807zM7.07 8l.2 3h9.462l.2-3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDrink;
