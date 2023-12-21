import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceSad = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17.657 6.343A8 8 0 1 0 6.343 17.657 8 8 0 0 0 17.657 6.343ZM4.929 4.93c3.905-3.905 10.237-3.905 14.142 0 3.905 3.905 3.905 10.237 0 14.142-3.905 3.905-10.237 3.905-14.142 0-3.905-3.905-3.905-10.237 0-14.142Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.463 14.464a5 5 0 0 1 7.071 0 1 1 0 1 1-1.414 1.415 3 3 0 0 0-4.243 0 1 1 0 0 1-1.414-1.415Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M10.5 9.5c0 .828-.56 1.5-1.25 1.5S8 10.328 8 9.5 8.56 8 9.25 8s1.25.672 1.25 1.5Zm5.5 0c0 .828-.56 1.5-1.25 1.5s-1.25-.672-1.25-1.5.56-1.5 1.25-1.5S16 8.672 16 9.5Z"
    />
  </Svg>
);
export default SvgFaceSad;
