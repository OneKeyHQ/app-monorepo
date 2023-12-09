import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImage2Mountains = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M14.25 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm8.707 10.293L19 17.586V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v7.586l2.293-2.293a1 1 0 0 1 1.414 0L12 14.586l1.293-1.293a1 1 0 0 1 1.414 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImage2Mountains;
