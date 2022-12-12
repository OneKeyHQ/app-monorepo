import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinusSm = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 10a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMinusSm;
