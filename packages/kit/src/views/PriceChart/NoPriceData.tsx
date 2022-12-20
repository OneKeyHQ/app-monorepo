import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

function SvgNoPriceData(props: SvgProps) {
  return (
    <Svg viewBox="0 0 358 160" fill="currentColor" {...props}>
      <Path
        d="M340.11 16.0064C347.852 16.0064 350.258 0 358 0V160H0V89.463C7.74194 89.463 15.484 95.038 23.2259 95.038C30.9679 95.038 38.7098 89.845 46.4518 88.9552C54.1937 88.0654 61.9358 88.5103 69.6778 87.6205C77.4197 86.7306 85.1615 74.6404 92.9034 71.9121C100.645 69.1838 108.387 100.56 116.129 97.8317C123.871 95.1034 131.613 47.4332 139.355 47.4332C147.097 47.4332 155.506 58.5234 163.248 58.5234C170.99 58.5234 178.065 43.7073 185.807 42.0845C193.549 40.4617 203.425 61.243 211.167 60.5171C218.909 59.7912 235.973 33.7274 243.715 33.7274C250.6 34.5138 250.6 44.5178 273.512 49.0196C281.254 49.0196 285.916 22.966 293.658 19.5183C301.4 16.0706 311.841 31.431 319.583 27.511C327.325 23.591 332.368 16.0064 340.11 16.0064Z"
        fill="url(#paint0_linear_5149_43265)"
      />
      <Defs>
        <LinearGradient
          id="paint0_linear_5149_43265"
          x1="179"
          y1="0"
          x2="179"
          y2="160"
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#3D3D4D" />
          <Stop offset="1" stopColor="#1D1D2A" stopOpacity="0" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

export default SvgNoPriceData;
