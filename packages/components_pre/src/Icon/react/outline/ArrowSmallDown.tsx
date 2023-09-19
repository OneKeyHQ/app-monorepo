import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowSmallDown = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m0 0 6.75-6.75M12 19.5l-6.75-6.75"
    />
  </Svg>
);
export default SvgArrowSmallDown;
