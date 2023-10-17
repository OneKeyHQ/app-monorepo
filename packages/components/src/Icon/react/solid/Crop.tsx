import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCrop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.5 9H9v5.5a.5.5 0 0 0 .5.5H15V9.5a.5.5 0 0 0-.5-.5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 2a1 1 0 0 1 1 1v2h9a3 3 0 0 1 3 3v9h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2H8a3 3 0 0 1-3-3V7H3a1 1 0 0 1 0-2h2V3a1 1 0 0 1 1-1Zm1 14V7h9a1 1 0 0 1 1 1v9H8a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCrop;
