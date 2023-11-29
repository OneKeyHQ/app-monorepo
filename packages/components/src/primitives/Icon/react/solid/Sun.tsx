import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSun = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13 2a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0V2Zm0 19a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0v-1Zm6.777-16.777a1 1 0 0 1 0 1.414l-.71.71a1 1 0 1 1-1.414-1.414l.71-.71a1 1 0 0 1 1.414 0ZM6.347 19.067a1 1 0 1 0-1.414-1.414l-.71.71a1 1 0 1 0 1.414 1.414l.71-.71ZM20 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1ZM2 11a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H2Zm15.653 6.653a1 1 0 0 1 1.414 0l.71.71a1 1 0 0 1-1.414 1.414l-.71-.71a1 1 0 0 1 0-1.414ZM5.637 4.223a1 1 0 1 0-1.414 1.414l.71.71a1 1 0 0 0 1.414-1.414l-.71-.71Zm2.12 3.534a6 6 0 1 1 8.486 8.486 6 6 0 0 1-8.486-8.486Z"
    />
  </Svg>
);
export default SvgSun;
