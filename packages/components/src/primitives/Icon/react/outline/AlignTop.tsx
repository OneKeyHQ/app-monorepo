import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlignTop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m16.25 11-3.543-3.543a1 1 0 0 0-1.414 0L7.75 11M12 21V7.75M19 3H5"
    />
  </Svg>
);
export default SvgAlignTop;
