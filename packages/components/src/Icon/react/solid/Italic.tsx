import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgItalic = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 4a1 1 0 0 1 1-1h9a1 1 0 1 1 0 2h-3.765L10.86 19H14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2h3.765L13.14 5H10a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgItalic;
