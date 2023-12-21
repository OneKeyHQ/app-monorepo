import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFocus = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.707 4.372a1 1 0 0 0-1.414 0L9.707 5.957a1 1 0 1 1-1.414-1.414l1.586-1.586a3 3 0 0 1 4.242 0l1.586 1.586a1 1 0 1 1-1.414 1.414l-1.586-1.585Zm-6.75 3.921a1 1 0 0 1 0 1.414l-1.586 1.586a1 1 0 0 0 0 1.414l1.586 1.586a1 1 0 1 1-1.414 1.414l-1.586-1.586a3 3 0 0 1 0-4.242l1.586-1.586a1 1 0 0 1 1.414 0Zm12.086 0a1 1 0 0 1 1.414 0l1.586 1.586a3 3 0 0 1 0 4.242l-1.586 1.586a1 1 0 0 1-1.414-1.414l1.586-1.586a1 1 0 0 0 0-1.414l-1.586-1.586a1 1 0 0 1 0-1.414Zm-9.75 9.75a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 0 1.414 0l1.586-1.586a1 1 0 0 1 1.414 1.414l-1.586 1.586a3 3 0 0 1-4.242 0l-1.586-1.586a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFocus;
