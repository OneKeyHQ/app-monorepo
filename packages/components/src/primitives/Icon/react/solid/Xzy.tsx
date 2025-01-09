import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgXzy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.293 3.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.414L10 6.414V14h10a1 1 0 1 1 0 2H9.414l-4.707 4.707a1 1 0 0 1-1.414-1.414L8 14.586V6.414L6.707 7.707a1 1 0 0 1-1.414-1.414l3-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgXzy;
