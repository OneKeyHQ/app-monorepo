import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSliderVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M18 13.126a4 4 0 1 1-2 0V4a1 1 0 1 1 2 0v9.126ZM7 21a1 1 0 0 1-1-1v-7.126a4 4 0 0 1 0-7.748V4a1 1 0 0 1 2 0v1.126a4 4 0 0 1 0 7.748V20a1 1 0 0 1-1 1Z"
    />
  </Svg>
);
export default SvgSliderVer;
