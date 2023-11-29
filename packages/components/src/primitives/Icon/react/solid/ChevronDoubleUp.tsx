import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.293 18.207a1 1 0 0 0 1.414 0L12 14.914l3.293 3.293a1 1 0 0 0 1.414-1.414L13.414 13.5a2 2 0 0 0-2.828 0l-3.293 3.293a1 1 0 0 0 0 1.414Zm0-7a1 1 0 0 0 1.414 0L12 7.914l3.293 3.293a1 1 0 0 0 1.414-1.414L13.414 6.5a2 2 0 0 0-2.828 0L7.293 9.793a1 1 0 0 0 0 1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleUp;
