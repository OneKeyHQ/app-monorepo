import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageQuestion = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.002 3h12a3 3 0 0 1 3 3v10.036a3 3 0 0 1-3 3h-2.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-2.65a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm3.622 6.178c0-1.38 1.11-2.515 2.5-2.515s2.5 1.135 2.5 2.515c0 1.128-.744 1.716-1.18 2.013a1.18 1.18 0 0 0-.294.262.762.762 0 0 0-.14.359 1 1 0 1 1-1.977-.297c.159-1.055.778-1.633 1.286-1.978.157-.107.23-.176.267-.226.026-.035.03-.073.035-.114l.003-.02a.507.507 0 0 0-.5-.514c-.268 0-.5.221-.5.515a1 1 0 0 1-2 0ZM12 15.75a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageQuestion;
