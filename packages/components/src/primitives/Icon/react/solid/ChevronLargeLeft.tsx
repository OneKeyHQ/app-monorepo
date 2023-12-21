import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLargeLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.486 2.126a1 1 0 0 1 .388 1.36l-4.46 8.029a1 1 0 0 0 0 .97l4.46 8.03a1 1 0 1 1-1.748.97l-4.46-8.028a3 3 0 0 1 0-2.914l4.46-8.028a1 1 0 0 1 1.36-.389Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLargeLeft;
