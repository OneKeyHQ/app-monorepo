import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBallRugby = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.162 2.576a13.03 13.03 0 0 0-8.586 8.586l10.262 10.262a13.03 13.03 0 0 0 8.586-8.586L11.162 2.576Zm3.295 8.381a1 1 0 0 0-1.414-1.414l-3.5 3.5a1 1 0 1 0 1.414 1.414l3.5-3.5Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M2 15c0-.507.03-1.008.086-1.5l8.414 8.414c-.492.057-.993.086-1.5.086H4a2 2 0 0 1-2-2v-5Zm19.914-4.5c.057-.492.086-.993.086-1.5V4a2 2 0 0 0-2-2h-5c-.507 0-1.008.03-1.5.086l8.414 8.414Z"
    />
  </Svg>
);
export default SvgBallRugby;
