import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRocketLaunch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="m15 14.912-3 2.55v1.772l2.514-1.509a1 1 0 0 0 .486-.857v-1.955Zm-5 2.502L6.586 14h-1.82c-1.554 0-2.515-1.696-1.715-3.029L4.56 8.457A3 3 0 0 1 7.132 7h3.683c2.524-2.67 5.386-4.631 9.1-4.953a1.88 1.88 0 0 1 2.038 2.039c-.322 3.713-2.283 6.575-4.953 9.1v3.682a3 3 0 0 1-1.457 2.572l-2.513 1.51c-1.333.8-3.029-.16-3.029-1.715v-1.82ZM9.088 9H7.132a1 1 0 0 0-.857.486L4.766 12h1.772l2.55-3ZM2 19a3 3 0 1 1 3 3H3a1 1 0 0 1-1-1v-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRocketLaunch;
