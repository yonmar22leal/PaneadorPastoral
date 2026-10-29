/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#F8FAFC',
    background: '#090D1A',
    backgroundElement: '#131B2E',
    backgroundSelected: '#1E293B',
    textSecondary: '#94A3B8',
    card: 'rgba(19, 27, 46, 0.85)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    primary: '#38BDF8',
    accentTeal: '#2DD4BF',
    accentRose: '#FB7185',
    accentViolet: '#A78BFA',
    accentAmber: '#FBBF24',
  },
  dark: {
    text: '#F8FAFC',
    background: '#070A14',
    backgroundElement: '#0F172A',
    backgroundSelected: '#1E293B',
    textSecondary: '#94A3B8',
    card: 'rgba(15, 23, 42, 0.85)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    primary: '#38BDF8',
    accentTeal: '#2DD4BF',
    accentRose: '#FB7185',
    accentViolet: '#A78BFA',
    accentAmber: '#FBBF24',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
