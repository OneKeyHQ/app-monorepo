import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGamepad = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 5a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4h14a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4H5Zm3 4a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2H9v1a1 1 0 1 1-2 0v-1H6a1 1 0 1 1 0-2h1v-1a1 1 0 0 1 1-1Zm9.75 2.75a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm-3 3a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGamepad;
