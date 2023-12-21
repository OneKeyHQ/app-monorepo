import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCommand = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9Zm0 0h6M9 9v6m6-6V6.5A2.5 2.5 0 1 1 17.5 9H15Zm0 0v6m0 0H9m6 0v2.5a2.5 2.5 0 1 0 2.5-2.5H15Zm-6 0v2.5A2.5 2.5 0 1 1 6.5 15H9Z"
    />
  </Svg>
);
export default SvgCommand;
