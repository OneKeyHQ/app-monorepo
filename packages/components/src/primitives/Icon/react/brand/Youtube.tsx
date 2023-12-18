import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgYoutube = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M20.204 4.008c.904.28 1.615 1.101 1.857 2.147C22.498 8.048 22.5 12 22.5 12s0 3.952-.44 5.845c-.241 1.046-.952 1.867-1.856 2.147C18.567 20.5 12 20.5 12 20.5s-6.567 0-8.204-.508c-.904-.28-1.615-1.101-1.857-2.147C1.5 15.952 1.5 12 1.5 12s0-3.952.44-5.845c.241-1.046.952-1.867 1.856-2.147C5.433 3.5 12 3.5 12 3.5s6.567 0 8.204.508ZM15.514 12l-5.716 3.3V8.7l5.715 3.3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgYoutube;
