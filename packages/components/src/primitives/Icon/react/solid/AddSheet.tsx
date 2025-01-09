import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddSheet = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 22a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7Zm2-11a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2V9a1 1 0 1 0-2 0v2H9Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddSheet;
