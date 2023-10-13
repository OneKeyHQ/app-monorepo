import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlignBottom = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m16.25 13-3.543 3.543a1 1 0 0 1-1.414 0L7.75 13M12 3v13.25M19 21H5"
    />
  </Svg>
);
export default SvgAlignBottom;
