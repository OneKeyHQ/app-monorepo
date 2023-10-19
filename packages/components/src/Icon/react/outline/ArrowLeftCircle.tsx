import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowLeftCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 12H8.75M11 15l-2.293-2.293a1 1 0 0 1 0-1.414L11 9m-8 3a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z"
    />
  </Svg>
);
export default SvgArrowLeftCircle;
