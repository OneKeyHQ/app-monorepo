import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDisk1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h1v-7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7h1a3 3 0 0 0 3-3V7.828a3 3 0 0 0-.879-2.12l-1.828-1.83A3 3 0 0 0 17 3.118V7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V3Z"
    />
    <Path fill="currentColor" d="M15 3H9v4h6V3Zm0 18v-7H9v7h6Z" />
  </Svg>
);
export default SvgDisk1;
