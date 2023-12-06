import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm3-12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-3 10a7.976 7.976 0 0 1-5.714-2.4C7.618 16.004 9.605 15 12 15c2.396 0 4.383 1.005 5.714 2.6A7.976 7.976 0 0 1 12 20Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleCircle;
