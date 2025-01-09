import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSliderHor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17 3a4 4 0 0 0-3.874 3H4a1 1 0 0 0 0 2h9.126A4 4 0 1 0 17 3ZM9 13a4 4 0 0 0-3.874 3H4a1 1 0 1 0 0 2h1.126a4 4 0 0 0 7.748 0H20a1 1 0 1 0 0-2h-7.126A4 4 0 0 0 9 13Z"
    />
  </Svg>
);
export default SvgSliderHor;
