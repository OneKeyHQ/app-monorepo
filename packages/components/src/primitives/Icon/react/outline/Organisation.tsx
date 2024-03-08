import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOrganisation = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2a5.5 5.5 0 0 0-1 10.91v1.235A3.508 3.508 0 0 0 8.645 16.5h-.79A3.502 3.502 0 0 0 1 17.5a3.5 3.5 0 0 0 6.855 1h.79a3.502 3.502 0 0 0 6.71 0h.79a3.502 3.502 0 0 0 6.855-1 3.5 3.5 0 0 0-6.855-1h-.79A3.508 3.508 0 0 0 13 14.145v-1.236A5.502 5.502 0 0 0 12 2ZM8.5 7.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0ZM3 17.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm7.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm7.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgOrganisation;
