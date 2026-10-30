import { DarkTheme, ThemeProvider } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ChurchProvider } from '@/context/ChurchContext';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

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

function AppContent() {
  const insets = useSafeAreaInsets();
  // Espacio exclusivo para APK en Android para evitar que los 3 botones de navegación del sistema
  // se mezclen o solapen con los botones de acción de la app. En Web se mantiene en 0.
  const androidBottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 28) : 0;

  // Verificación silenciosa de actualizaciones OTA en segundo plano (EAS Update)
  useEffect(() => {
    async function checkAutoUpdate() {
      if (__DEV__ || Platform.OS === 'web') return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
        }
      } catch {}
    }
    checkAutoUpdate();
  }, []);

  return (
    <View style={{ flex: 1, paddingBottom: androidBottomPadding, backgroundColor: '#070A14' }}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </View>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={appDarkTheme}>
        <StatusBar style="light" />
        {Platform.OS === 'android' && <NavigationBar style="light" />}
        <ChurchProvider>
          <AppContent />
        </ChurchProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
