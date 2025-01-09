import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPrime = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 12H1l3-9h10a8 8 0 1 1 0 16v2H5v-9Zm9 5a6 6 0 0 0 0-12v12Zm-7 2h5V5H5.442l-1.667 5H7v9Z"
    />
  </Svg>
);
export default SvgPrime;
