import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowSmLeft = (props: SvgProps) => (
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
      d="m11 17-5-5m0 0 5-5m-5 5h12"
    />
  </Svg>
);
export default SvgArrowSmLeft;
