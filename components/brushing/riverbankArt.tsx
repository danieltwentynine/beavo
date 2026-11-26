// Artwork from beavo-design/design/riverbank-scene.svg, split at the original motion groups.
import { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';

import { BeavoWave } from '@/components/brand/BeavoBrand';
import { colors } from '@/lib/tokens';

export const riverbankBackdrop = (
  <>
    <Defs>
      <LinearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0" stopColor={colors.sceneSkyTop} />
        <Stop offset=".62" stopColor="#E6F5EE" />
      </LinearGradient>
      <LinearGradient id="riv" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0" stopColor="#7FCADB" />
        <Stop offset="1" stopColor="#5BB3C9" />
      </LinearGradient>
    </Defs>
    <Rect width="390" height="844" fill="url(#sky)" />
    <Circle cx="58" cy="410" r="28" fill="#FFD36B" />
    <Circle cx="50" cy="404" r="3" fill="#E39A1C" />
    <Circle cx="66" cy="404" r="3" fill="#E39A1C" />
    <Path d="M50 416 q8 7 16 0" stroke="#E39A1C" strokeWidth="3" fill="none" strokeLinecap="round" />
    <Path d="M0 548 Q80 500 175 530 T390 512 V844 H0Z" fill="#C3E4A3" />
    <Path d="M0 606 Q110 566 230 600 T390 588 V844 H0Z" fill="#9FD27A" />
    <G transform="translate(30 596) scale(1)">
      <Path d="M0 0v14" stroke="#5E9E46" strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="6.0" cy="0.0" r="4.6" fill="#F48FB1" />
      <Circle cx="1.9" cy="5.7" r="4.6" fill="#F48FB1" />
      <Circle cx="-4.9" cy="3.5" r="4.6" fill="#F48FB1" />
      <Circle cx="-4.9" cy="-3.5" r="4.6" fill="#F48FB1" />
      <Circle cx="1.9" cy="-5.7" r="4.6" fill="#F48FB1" />
      <Circle r="3.4" fill="#FFE08A" />
    </G>
    <G transform="translate(62 606) scale(1)">
      <Path d="M0 0v14" stroke="#5E9E46" strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="6.0" cy="0.0" r="4.6" fill="#fff" />
      <Circle cx="1.9" cy="5.7" r="4.6" fill="#fff" />
      <Circle cx="-4.9" cy="3.5" r="4.6" fill="#fff" />
      <Circle cx="-4.9" cy="-3.5" r="4.6" fill="#fff" />
      <Circle cx="1.9" cy="-5.7" r="4.6" fill="#fff" />
      <Circle r="3.4" fill="#FFE08A" />
    </G>
    <G transform="translate(118 590) scale(0.9)">
      <Path d="M0 0v14" stroke="#5E9E46" strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="6.0" cy="0.0" r="4.6" fill="#B83A75" />
      <Circle cx="1.9" cy="5.7" r="4.6" fill="#B83A75" />
      <Circle cx="-4.9" cy="3.5" r="4.6" fill="#B83A75" />
      <Circle cx="-4.9" cy="-3.5" r="4.6" fill="#B83A75" />
      <Circle cx="1.9" cy="-5.7" r="4.6" fill="#B83A75" />
      <Circle r="3.4" fill="#FFE08A" />
    </G>
    <G transform="translate(250 604) scale(0.9)">
      <Path d="M0 0v14" stroke="#5E9E46" strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="6.0" cy="0.0" r="4.6" fill="#F48FB1" />
      <Circle cx="1.9" cy="5.7" r="4.6" fill="#F48FB1" />
      <Circle cx="-4.9" cy="3.5" r="4.6" fill="#F48FB1" />
      <Circle cx="-4.9" cy="-3.5" r="4.6" fill="#F48FB1" />
      <Circle cx="1.9" cy="-5.7" r="4.6" fill="#F48FB1" />
      <Circle r="3.4" fill="#FFE08A" />
    </G>
    <G transform="translate(150 600) scale(0.8)">
      <Path d="M0 0v14" stroke="#5E9E46" strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="6.0" cy="0.0" r="4.6" fill="#fff" />
      <Circle cx="1.9" cy="5.7" r="4.6" fill="#fff" />
      <Circle cx="-4.9" cy="3.5" r="4.6" fill="#fff" />
      <Circle cx="-4.9" cy="-3.5" r="4.6" fill="#fff" />
      <Circle cx="1.9" cy="-5.7" r="4.6" fill="#fff" />
      <Circle r="3.4" fill="#FFE08A" />
    </G>
    <Path d="M0 664 Q195 646 390 664 V844 H0Z" fill="url(#riv)" />
    <G>
      <G>
        <Rect x="268" y="653" width="140" height="22" rx="11" fill="#9C6B43" />
        <Path d="M282 661h106" stroke="#7E5332" strokeWidth="2" strokeLinecap="round" />
        <Circle cx="397" cy="664" r="11" fill="#E8C496" />
        <Circle cx="397" cy="664" r="6.050000000000001" fill="none" stroke="#B98757" strokeWidth="1.6" />
      </G>
      <G>
        <Rect x="282" y="631" width="120" height="22" rx="11" fill="#9C6B43" />
        <Path d="M296 639h86" stroke="#7E5332" strokeWidth="2" strokeLinecap="round" />
        <Circle cx="391" cy="642" r="11" fill="#E8C496" />
        <Circle cx="391" cy="642" r="6.050000000000001" fill="none" stroke="#B98757" strokeWidth="1.6" />
      </G>
      <G>
        <Rect x="300" y="609" width="100" height="22" rx="11" fill="#9C6B43" />
        <Path d="M314 617h66" stroke="#7E5332" strokeWidth="2" strokeLinecap="round" />
        <Circle cx="389" cy="620" r="11" fill="#E8C496" />
        <Circle cx="389" cy="620" r="6.050000000000001" fill="none" stroke="#B98757" strokeWidth="1.6" />
      </G>
      <G>
        <Rect x="318" y="588" width="80" height="20" rx="10" fill="#9C6B43" />
        <Path d="M332 595h46" stroke="#7E5332" strokeWidth="2" strokeLinecap="round" />
        <Circle cx="388" cy="598" r="10" fill="#E8C496" />
        <Circle cx="388" cy="598" r="5.5" fill="none" stroke="#B98757" strokeWidth="1.6" />
      </G>
      <Path d="M258 676 q6 -8 12 0 M276 650 q5 -7 10 0" stroke="#5E9E46" strokeWidth="3" fill="none" strokeLinecap="round" />
    </G>
  </>
);

export const sunRays = (
  <>
    <G stroke="#FFC94D" strokeWidth="5" strokeLinecap="round">
      <Path d="M96.0 410.0 L108.0 410.0" />
      <Path d="M88.7 432.3 L98.5 439.4" />
      <Path d="M69.7 446.1 L73.5 457.6" />
      <Path d="M46.3 446.1 L42.5 457.6" />
      <Path d="M27.3 432.3 L17.5 439.4" />
      <Path d="M20.0 410.0 L8.0 410.0" />
      <Path d="M27.3 387.7 L17.5 380.6" />
      <Path d="M46.3 373.9 L42.5 362.4" />
      <Path d="M69.7 373.9 L73.5 362.4" />
      <Path d="M88.7 387.7 L98.5 380.6" />
    </G>
  </>
);

export const cloud = (
  <>
    <Path d="M0 22a12 12 0 0 1 12-12 16 16 0 0 1 30-4 13 13 0 0 1 22 8 10 10 0 0 1 0 20H8A9 9 0 0 1 0 22z" fill="#fff" />
  </>
);

export const floatingLog = (
  <>
    <G>
      <Rect x="150" y="730" width="70" height="16" rx="8" fill="#9C6B43" />
      <Path d="M164 735h36" stroke="#7E5332" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="212" cy="738" r="8" fill="#E8C496" />
      <Circle cx="212" cy="738" r="4.4" fill="none" stroke="#B98757" strokeWidth="1.6" />
    </G>
  </>
);

export const babyBeaver = (
  <>
    <G transform="translate(0 0)">
      <Svg x="0" y="684" viewBox="22 22 156 130" width="38" height="32">
        <Circle cx="42" cy="60" r="13" fill="#8A5634" />
        <Circle cx="42" cy="60" r="6.5" fill="#5E3820" />
        <Circle cx="158" cy="60" r="13" fill="#8A5634" />
        <Circle cx="158" cy="60" r="6.5" fill="#5E3820" />
        <Ellipse cx="100" cy="90" rx="64" ry="56" fill="#8A5634" />
        <Ellipse cx="60" cy="110" rx="22" ry="20" fill="#8A5634" />
        <Ellipse cx="140" cy="110" rx="22" ry="20" fill="#8A5634" />
        <Path d="M90 36 q5 -10 10 0 q5 -10 10 0" fill="none" stroke="#5E3820" strokeWidth="4" strokeLinecap="round" />
        <Ellipse cx="64" cy="108" rx="10" ry="6" fill="#F2A08F" opacity=".55" />
        <Ellipse cx="136" cy="108" rx="10" ry="6" fill="#F2A08F" opacity=".55" />
        <Ellipse cx="100" cy="113" rx="36" ry="24" fill="#E8C9A2" />
        <G fill="#5E3820" opacity=".55">
          <Circle cx="76" cy="108" r="1.8" />
          <Circle cx="72" cy="114" r="1.8" />
          <Circle cx="78" cy="116" r="1.8" />
          <Circle cx="124" cy="108" r="1.8" />
          <Circle cx="128" cy="114" r="1.8" />
          <Circle cx="122" cy="116" r="1.8" />
        </G>
        <Circle cx="76" cy="82" r="9.5" fill="#2A1A12" />
        <Circle cx="79.5" cy="78.5" r="3.2" fill="#fff" />
        <Circle cx="124" cy="82" r="9.5" fill="#2A1A12" />
        <Circle cx="127.5" cy="78.5" r="3.2" fill="#fff" />
        <Rect x="88.5" y="116" width="11" height="23" rx="3.5" fill="#FFFDF7" stroke="#2A1A12" strokeWidth="2" />
        <Rect x="100.5" y="116" width="11" height="23" rx="3.5" fill="#FFFDF7" stroke="#2A1A12" strokeWidth="2" />
        <Path d="M82 114 Q100 122 118 114" fill="none" stroke="#2A1A12" strokeWidth="3" strokeLinecap="round" />
        <Ellipse cx="100" cy="100" rx="13" ry="9" fill="#2A1A12" />
        <Ellipse cx="96" cy="97" rx="4" ry="2.4" fill="#fff" opacity=".7" />
      </Svg>
      <Path d="M-4 712 q24 -6 46 0" stroke={colors.sceneRipple} strokeWidth="3" fill="none" strokeLinecap="round" />
    </G>
  </>
);

export const duck = (
  <>
    <G>
      <Ellipse cx="0" cy="0" rx="17" ry="10" fill="#fff" />
      <Path d="M-17 -2 q-6 -6 -2 -10 q4 6 6 6z" fill="#fff" />
      <Circle cx="10" cy="-12" r="8" fill="#fff" />
      <Path d="M17 -12 l8 2 -8 3z" fill="#F29A38" />
      <Circle cx="12" cy="-14" r="1.8" fill="#22302E" />
      <Path d="M-8 -2 q6 5 12 0" stroke="#D9E4E2" strokeWidth="2" fill="none" />
    </G>
  </>
);

export const fish = (
  <>
    <G>
      <Path d="M0 0 q14 -12 28 0 q-14 12 -28 0z" fill="#F2876B" />
      <Path d="M0 0 l-10 -8 v16z" fill="#F2876B" />
      <Circle cx="20" cy="-2" r="2" fill="#22302E" />
    </G>
  </>
);

export const reed1 = (
  <>
    <G transform="translate(10 0)">
      <Path d="M0 690 Q-3 650 2 612" stroke="#5E9E46" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </G>
  </>
);

export const reed2 = (
  <>
    <G transform="translate(10 0)">
      <Path d="M9 690 Q6 642 11 602" stroke="#5E9E46" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Ellipse cx="11" cy="612" rx="4" ry="11" fill="#8A5634" />
    </G>
  </>
);

export const reed3 = (
  <>
    <G transform="translate(10 0)">
      <Path d="M18 690 Q15 634 20 592" stroke="#5E9E46" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </G>
  </>
);

export const reed4 = (
  <>
    <G transform="translate(10 0)">
      <Path d="M27 690 Q24 626 29 582" stroke="#5E9E46" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Ellipse cx="29" cy="592" rx="4" ry="11" fill="#8A5634" />
    </G>
  </>
);
export const beaverOnDam = (
  <G transform="translate(300 500)">
    <BeavoWave width={92} height={88} accessible={false} />
  </G>
);
