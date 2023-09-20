import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowCircleLeft = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm.707-10.293a1 1 0 0 0-1.414-1.414l-3 3a1 1 0 0 0 0 1.414l3 3a1 1 0 0 0 1.414-1.414L9.414 11H13a1 1 0 1 0 0-2H9.414l1.293-1.293z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowCircleLeft;
