import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRecord = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7.5 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm8 1a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm10.67 1a3 3 0 1 1 2.83 2h-7a3 3 0 1 1 2.83-2h1.34Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRecord;
