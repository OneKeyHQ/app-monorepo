import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNotification = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 18c-.673 1.766-2.21 3-4 3s-3.327-1.234-4-3m-1.716 0h11.432a2 2 0 0 0 1.982-2.264l-.905-6.789a6.853 6.853 0 0 0-13.586 0l-.905 6.789A2 2 0 0 0 6.284 18Z"
    />
  </Svg>
);
export default SvgNotification;
