import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCodeBrackets = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.242 3.03a1 1 0 0 1 .728 1.213l-4 16a1 1 0 1 1-1.94-.485l4-16a1 1 0 0 1 1.213-.728ZM6.707 7.293a1 1 0 0 1 0 1.414l-2.586 2.586a1 1 0 0 0 0 1.414l2.586 2.586a1 1 0 1 1-1.414 1.414l-2.586-2.586a3 3 0 0 1 0-4.242l2.586-2.586a1 1 0 0 1 1.414 0Zm10.586 0a1 1 0 0 1 1.414 0l2.586 2.586a3 3 0 0 1 0 4.242l-2.586 2.586a1 1 0 1 1-1.414-1.414l2.586-2.586a1 1 0 0 0 0-1.414l-2.586-2.586a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCodeBrackets;
