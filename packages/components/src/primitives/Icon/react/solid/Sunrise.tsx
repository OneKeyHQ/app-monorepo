import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSunrise = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1ZM2 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm17 0a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1Zm-2.05-4.95a1 1 0 0 1 0-1.414l.706-.707a1 1 0 0 1 1.415 1.414l-.708.707a1 1 0 0 1-1.414 0ZM2 16a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm4 4a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1ZM4.93 4.929a1 1 0 0 1 1.414 0l.707.707A1 1 0 1 1 5.637 7.05l-.707-.707a1 1 0 0 1 0-1.414ZM8 13a1 1 0 0 1-1-1 5 5 0 0 1 10 0 1 1 0 0 1-1 1H8Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSunrise;
