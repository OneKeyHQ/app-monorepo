import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.293 5.793a1 1 0 0 1 1.414 0L12 9.086l3.293-3.293a1 1 0 1 1 1.414 1.414L13.414 10.5a2 2 0 0 1-2.828 0L7.293 7.207a1 1 0 0 1 0-1.414Zm0 7a1 1 0 0 1 1.414 0L12 16.086l3.293-3.293a1 1 0 0 1 1.414 1.414L13.414 17.5a2 2 0 0 1-2.828 0l-3.293-3.293a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleDown;
