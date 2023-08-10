import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBoltSlash = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2.22 2.22a.75.75 0 0 1 1.06 0l14.5 14.5a.75.75 0 1 1-1.06 1.06L2.22 3.28a.75.75 0 0 1 0-1.06z"
      clipRule="evenodd"
    />
    <Path d="M4.73 7.912 2.191 10.75A.75.75 0 0 0 2.75 12h6.068L4.73 7.912zm4.503 4.503-1.216 5.678a.75.75 0 0 0 1.292.657l2.956-3.303-3.032-3.032zm6.037-.327 2.539-2.838A.75.75 0 0 0 17.25 8h-6.068l4.088 4.088zm-4.503-4.503 1.216-5.678a.75.75 0 0 0-1.292-.657L7.735 4.553l3.032 3.032z" />
  </Svg>
);
export default SvgBoltSlash;
