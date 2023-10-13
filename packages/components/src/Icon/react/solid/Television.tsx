import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTelevision = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6.71 2.886a1 1 0 0 1 1.404-.175L12 5.733l3.886-3.022a1 1 0 0 1 1.228 1.578L14.914 6H19a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h4.085L6.886 4.29a1 1 0 0 1-.175-1.404Z"
    />
  </Svg>
);
export default SvgTelevision;
