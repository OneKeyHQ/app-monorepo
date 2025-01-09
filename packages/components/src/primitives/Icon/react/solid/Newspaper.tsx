import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNewspaper = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M8 11V9h3v2H8Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 6a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v5h2a3 3 0 0 1 3 3v3.5a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5V6Zm16.5 13a1.5 1.5 0 0 0 1.5-1.5V14a1 1 0 0 0-1-1h-2v4.5a1.5 1.5 0 0 0 1.5 1.5ZM6 16a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1-9a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNewspaper;
