import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPrime = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path fillRule="evenodd" clipRule="evenodd" d="M1 12h4v9h7V3H4l-3 9Z" />
    <Path d="M22 11a8 8 0 0 0-8-8v16a8 8 0 0 0 8-8Z" />
  </Svg>
);
export default SvgPrime;
