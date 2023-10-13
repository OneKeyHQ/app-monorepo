import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHomeLine = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.108 1.999a3 3 0 0 1 3.784 0l6 4.875A3 3 0 0 1 21 9.202V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9.202a3 3 0 0 1 1.108-2.328l6-4.875ZM8 15a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHomeLine;
