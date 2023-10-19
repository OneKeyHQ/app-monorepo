import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronTop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.707 9.121a1 1 0 0 0-1.414 0l-6.586 6.586a1 1 0 1 1-1.414-1.414l6.586-6.586a3 3 0 0 1 4.242 0l6.586 6.586a1 1 0 0 1-1.414 1.414l-6.586-6.586Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronTop;
