import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColorSwatch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9.25 16.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 5a3 3 0 0 1 3-3h5c.466 0 .91.107 1.305.298.438.032.876.161 1.28.395l4.33 2.5c.405.233.736.548.983.911.362.247.676.577.91.98l2.5 4.331a3 3 0 0 1-1.099 4.098l-9.877 5.703A5.5 5.5 0 0 1 2 16.5V5Zm7.302 14.5-.052.031A3.5 3.5 0 0 1 4 16.5V5a1 1 0 0 1 1-1h5a.999.999 0 0 1 1 1v11.5c0 .63-.167 1.222-.458 1.733l-.017.029A3.517 3.517 0 0 1 9.302 19.5Zm4.225-2.438 5.682-3.28a1 1 0 0 0 .366-1.367l-1.682-2.914-4.366 7.56ZM13 13.975l3.282-5.684a.999.999 0 0 0-.366-1.366L13 5.24v8.734Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorSwatch;
