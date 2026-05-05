import { usePlayerStore } from './store/playerStore';

export const DarkTheme = {
  // Backgrounds
  bg: '#0D0D1A',
  dark: '#0A0A12',
  darkSurface: '#141426',
  surface: '#16162E',
  cardBg: '#1C1C34',
  darkCard: '#222240',

  // Accent purple
  accent: '#7C7CFF',
  accentLight: '#B0B0FF',
  accentDim: 'rgba(124,124,255,0.15)',
  accentBorder: 'rgba(124,124,255,0.35)',

  // Text
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.60)',
  textMuted: 'rgba(255,255,255,0.40)',
  textVeryMuted: 'rgba(255,255,255,0.20)',
  textPressed: 'rgba(255,255,255,0.10)',
  
  // Specific text/background aliases (for easy migration)
  white: '#FFFFFF',
  white06: 'rgba(255,255,255,0.06)',
  white10: 'rgba(255,255,255,0.10)',
  white15: 'rgba(255,255,255,0.15)',
  white20: 'rgba(255,255,255,0.20)',
  white40: 'rgba(255,255,255,0.40)',
  white60: 'rgba(255,255,255,0.60)',
  white80: 'rgba(255,255,255,0.80)',

  black06: 'rgba(0,0,0,0.06)',
  black12: 'rgba(0,0,0,0.12)',
  black25: 'rgba(0,0,0,0.25)',
  black40: 'rgba(0,0,0,0.40)',

  // Type badges
  pdfRed: '#FF6B6B',
  epubBlue: '#6BA8FF',
  txtGreen: '#52D9A4',

  // Semantic
  danger: '#FF5B5B',
  success: '#52C97D',

  // Separators / borders
  separator: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
};

export const LightTheme = {
  // Backgrounds
  bg: '#F8F9FE',
  dark: '#FFFFFF',
  darkSurface: '#F0F2FA',
  surface: '#FFFFFF',
  cardBg: '#FFFFFF',
  darkCard: '#FFFFFF',

  // Accent purple
  accent: '#5A5AFF',
  accentLight: '#7C7CFF',
  accentDim: 'rgba(90,90,255,0.08)',
  accentBorder: 'rgba(90,90,255,0.15)',

  // Text
  text: '#1A1A2E',
  textDim: 'rgba(26,26,46,0.60)',
  textMuted: 'rgba(26,26,46,0.40)',
  textVeryMuted: 'rgba(26,26,46,0.20)',
  textPressed: 'rgba(26,26,46,0.05)',

  // Aliases (mapping "white" to dark text in light theme where it makes sense, 
  // or keeping it as white if it's used on accent backgrounds)
  white: '#1A1A2E', 
  white06: 'rgba(0,0,0,0.03)',
  white10: 'rgba(0,0,0,0.05)',
  white15: 'rgba(0,0,0,0.08)',
  white20: 'rgba(0,0,0,0.12)',
  white40: 'rgba(0,0,0,0.30)',
  white60: 'rgba(0,0,0,0.50)',
  white80: 'rgba(0,0,0,0.75)',

  black06: 'rgba(0,0,0,0.06)',
  black12: 'rgba(0,0,0,0.12)',
  black25: 'rgba(0,0,0,0.25)',
  black40: 'rgba(0,0,0,0.40)',

  // Type badges
  pdfRed: '#E54D4D',
  epubBlue: '#4A90E2',
  txtGreen: '#3DA37A',

  // Semantic
  danger: '#D94545',
  success: '#3DA37A',

  // Separators / borders
  separator: 'rgba(0,0,0,0.05)',
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.12)',
};

// For backward compatibility and single-theme usage
export const Colors = DarkTheme;

export function useAppTheme() {
  const theme = usePlayerStore((s) => s.settings.theme);
  return theme === 'light' ? LightTheme : DarkTheme;
}

export const Fonts = {
  regular: { fontWeight: '400' as const },
  medium: { fontWeight: '500' as const },
  semibold: { fontWeight: '600' as const },
  bold: { fontWeight: '700' as const },
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};
