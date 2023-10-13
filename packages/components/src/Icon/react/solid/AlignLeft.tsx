import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlignLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm8.707 3.043a1 1 0 0 1 0 1.414L9.164 11H21a1 1 0 1 1 0 2H9.164l2.543 2.543a1 1 0 0 1-1.414 1.414L6.75 13.414a2 2 0 0 1 0-2.828l3.543-3.543a1 1 0 0 1 1.414 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAlignLeft;
