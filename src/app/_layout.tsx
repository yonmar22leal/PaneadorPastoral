import { DarkTheme, ThemeProvider } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ChurchProvider } from '@/context/ChurchContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  SystemUI.setBackgroundColorAsync('#070A14').catch(() => {});
}

const appDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#070A14',
    card: '#070A14',
  },
};

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={appDarkTheme}>
        <StatusBar style="light" />
        {Platform.OS === 'android' && <NavigationBar style="light" />}
        <ChurchProvider>
          <AnimatedSplashOverlay />
          <AppTabs />
        </ChurchProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
