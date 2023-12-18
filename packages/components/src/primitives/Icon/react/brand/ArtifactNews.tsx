import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArtifactNews = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M22.002 10.625h-7.618l3.814-6.593-2.38-1.376-2.442 4.22V2h-2.75v7.617L4.031 5.804l-1.376 2.38 4.221 2.441H2v2.75h7.617l-3.813 6.593 2.381 1.378 2.44-4.221V22h2.751v-7.616l6.594 3.814 1.376-2.382-4.221-2.441h4.877v-2.75Z"
    />
  </Svg>
);
export default SvgArtifactNews;
