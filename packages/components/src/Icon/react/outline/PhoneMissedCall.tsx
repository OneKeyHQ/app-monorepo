import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPhoneMissedCall = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m16 8 2-2m0 0 2-2m-2 2-2-2m2 2 2 2M5 3a2 2 0 0 0-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 0 0 2-2v-3.28a1 1 0 0 0-.684-.948l-4.493-1.498a1 1 0 0 0-1.21.502l-1.13 2.257a11.042 11.042 0 0 1-5.516-5.517l2.257-1.128a1 1 0 0 0 .502-1.21L9.228 3.683A1 1 0 0 0 8.279 3H5z"
    />
  </Svg>
);
export default SvgPhoneMissedCall;
