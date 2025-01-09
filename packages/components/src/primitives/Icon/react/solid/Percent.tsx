import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPercent = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm4.207 5.793a1 1 0 0 1 0 1.414l-7 7a1 1 0 0 1-1.414-1.414l7-7a1 1 0 0 1 1.414 0ZM10.25 9a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm6 6a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPercent;
