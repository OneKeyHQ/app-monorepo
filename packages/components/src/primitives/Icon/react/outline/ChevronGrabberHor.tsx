import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronGrabberHor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 16-3.293-3.293a1 1 0 0 1 0-1.414L9 8m6 8 3.293-3.293a1 1 0 0 0 0-1.414L15 8"
    />
  </Svg>
);
export default SvgChevronGrabberHor;
