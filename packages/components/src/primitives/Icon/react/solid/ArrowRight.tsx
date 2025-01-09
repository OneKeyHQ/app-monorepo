import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="m18.375 13.04-4.293 4.292a1 1 0 0 0 1.414 1.414l4.586-4.585a3 3 0 0 0 0-4.243l-4.586-4.586a1 1 0 1 0-1.414 1.414l4.293 4.293H4.039a1 1 0 0 0 0 2h14.336Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowRight;
