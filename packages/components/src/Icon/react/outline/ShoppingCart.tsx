import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShoppingCart = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"
    />
  </Svg>
);
export default SvgShoppingCart;
