import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowBottom = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="m11 18.414-4.293-4.293a1 1 0 0 0-1.414 1.415l4.586 4.585a3 3 0 0 0 4.242 0l4.586-4.585a1 1 0 0 0-1.414-1.415L13 18.414V4.078a1 1 0 1 0-2 0v14.336Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowBottom;
