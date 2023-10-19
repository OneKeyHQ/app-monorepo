import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.293 3.293a1 1 0 0 1 1.414 0L9 7.586V4a1 1 0 0 1 2 0v5.25A1.75 1.75 0 0 1 9.25 11H4a1 1 0 1 1 0-2h3.586L3.293 4.707a1 1 0 0 1 0-1.414ZM13 7a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-5a1 1 0 1 1 2 0v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-5a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDock;
