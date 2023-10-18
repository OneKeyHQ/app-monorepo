import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLargeTop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.486 10.413a1 1 0 0 0-.972 0l-8.028 4.46a1 1 0 1 1-.972-1.748l8.03-4.46a3 3 0 0 1 2.913 0l8.029 4.46a1 1 0 0 1-.972 1.748l-8.028-4.46Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLargeTop;
