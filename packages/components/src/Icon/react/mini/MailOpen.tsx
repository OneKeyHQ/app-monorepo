import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMailOpen = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2.94 6.412A2 2 0 0 0 2 8.108V16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.108a2 2 0 0 0-.94-1.696l-6-3.75a2 2 0 0 0-2.12 0l-6 3.75zm2.615 2.423a1 1 0 1 0-1.11 1.664l5 3.333a1 1 0 0 0 1.11 0l5-3.333a1 1 0 0 0-1.11-1.664L10 11.798 5.555 8.835z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMailOpen;
