import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCompass = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m9.946 14.054 1.027-3.081 3.081-1.027-1.027 3.081-3.081 1.027Z" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M21.75 12c0 5.385-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12 6.615 2.25 12 2.25s9.75 4.365 9.75 9.75Zm-5.799-3.003a.75.75 0 0 0-.948-.948l-4.86 1.62a.75.75 0 0 0-.475.474l-1.62 4.86a.75.75 0 0 0 .95.948l4.86-1.62a.75.75 0 0 0 .473-.474l1.62-4.86Z"
    />
  </Svg>
);
export default SvgCompass;
