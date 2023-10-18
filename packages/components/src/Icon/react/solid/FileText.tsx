import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileText = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2H7a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-9h-5a3 3 0 0 1-3-3V2ZM8 14a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6.5a1 1 0 1 0 0-2H9Z"
      clipRule="evenodd"
    />
    <Path fill="currentColor" d="M19.414 8 14 2.586V7a1 1 0 0 0 1 1h4.414Z" />
  </Svg>
);
export default SvgFileText;
