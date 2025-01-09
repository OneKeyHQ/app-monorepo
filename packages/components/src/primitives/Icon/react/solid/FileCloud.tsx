import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileCloud = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2H7a3 3 0 0 0-3 3v6.917a6.237 6.237 0 0 1 2.25-.417c1.673 0 3.192.659 4.311 1.725A5.501 5.501 0 0 1 13.243 22H17a3 3 0 0 0 3-3v-9h-5a3 3 0 0 1-3-3V2Z"
    />
    <Path fill="currentColor" d="M19.414 8 14 2.586V7a1 1 0 0 0 1 1h4.414Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.25 13.5a4.25 4.25 0 0 0 0 8.5H9a3.5 3.5 0 0 0 .523-6.961A4.241 4.241 0 0 0 6.25 13.5ZM4 17.75a2.25 2.25 0 0 1 4.147-1.21 1 1 0 0 0 .844.46H9a1.5 1.5 0 0 1 0 3H6.25A2.25 2.25 0 0 1 4 17.75Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFileCloud;
