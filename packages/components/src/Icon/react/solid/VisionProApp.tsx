import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVisionProApp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-.05a2.5 2.5 0 0 1-2.45 2h-9a2.5 2.5 0 0 1-2.45-2H6a3 3 0 0 1-3-3V7Zm15 10.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0 0 1h9a.5.5 0 0 0 .5-.5ZM1 8a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVisionProApp;
