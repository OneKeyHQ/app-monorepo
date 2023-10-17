import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraExposureSparkles = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2"
    />
    <Path
      fill="currentColor"
      d="M12.184 9.29a.5.5 0 0 0 .224-.224l.645-1.29a.5.5 0 0 1 .894 0l.645 1.29a.5.5 0 0 0 .224.224l1.29.645a.5.5 0 0 1 0 .894l-1.29.645a.5.5 0 0 0-.224.224l-.645 1.29a.5.5 0 0 1-.894 0l-.645-1.29a.5.5 0 0 0-.223-.224l-1.29-.645a.5.5 0 0 1 0-.894l1.29-.645Zm-3.606 4.303a.3.3 0 0 0 .134-.134l.52-1.04a.3.3 0 0 1 .537 0l.52 1.04a.3.3 0 0 0 .134.134l1.04.52a.3.3 0 0 1 0 .537l-1.04.52a.3.3 0 0 0-.134.135l-.52 1.04a.3.3 0 0 1-.537 0l-.52-1.04a.3.3 0 0 0-.134-.134l-1.041-.52a.3.3 0 0 1 0-.537l1.04-.52Z"
    />
  </Svg>
);
export default SvgCameraExposureSparkles;
