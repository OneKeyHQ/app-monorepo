import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCommandKey = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 8.5V9h-.5a.5.5 0 1 1 .5-.5Zm2 4.5v-2h2v2h-2Zm-2.5 2H9v.5a.5.5 0 1 1-.5-.5Zm6.5.5V15h.5a.5.5 0 1 1-.5.5Zm.5-6.5H15v-.5a.5.5 0 1 1 .5.5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm2.5 3a2.5 2.5 0 0 0 0 5H9v2h-.5a2.5 2.5 0 1 0 2.5 2.5V15h2v.5a2.5 2.5 0 1 0 2.5-2.5H15v-2h.5A2.5 2.5 0 1 0 13 8.5V9h-2v-.5A2.5 2.5 0 0 0 8.5 6Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCommandKey;
