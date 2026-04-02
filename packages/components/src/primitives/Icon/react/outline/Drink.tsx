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
      d="M17.693 2.759 13 3.802V6h6.07l-1.134 17H6.064L4.931 6H11V2.198L17.259.807zM7.403 13l.533 8h8.128l.534-8zm-.133-2h9.46l.2-3H7.07z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDrink;
