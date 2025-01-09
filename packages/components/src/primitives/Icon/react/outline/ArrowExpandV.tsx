import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowExpandV = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m8 5.75 3.293-3.293a1 1 0 0 1 1.414 0L16 5.75m-8 12.5 3.293 3.293a1 1 0 0 0 1.414 0L16 18.25M12 21V3"
    />
  </Svg>
);
export default SvgArrowExpandV;
