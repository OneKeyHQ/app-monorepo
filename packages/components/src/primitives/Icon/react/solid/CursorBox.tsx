import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursorBox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a1 1 0 1 1-2 0V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3V6Z"
    />
    <Path
      fill="currentColor"
      d="M12.845 11.009a1.5 1.5 0 0 0-1.837 1.837l2.213 8.25c.346 1.29 2.078 1.518 2.747.363l2.013-3.477 3.477-2.013c1.155-.669.927-2.4-.363-2.747l-8.25-2.213Z"
    />
  </Svg>
);
export default SvgCursorBox;
