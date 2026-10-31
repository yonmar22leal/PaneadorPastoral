import { DarkTheme, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Alert, BackHandler, Platform, View } from 'react-native';

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

/**
 * Manejador del botón físico y gesto de atrás en Android.
 * Regresa a la pestaña/pantalla anterior y, si ya está en la raíz (Home o Login),
 * muestra un diálogo de confirmación antes de salir de la aplicación.
 */
function AndroidBackHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const historyRef = useRef<string[]>([]);
  const isBackActionRef = useRef(false);

  // Registrar cada pantalla visitada en el historial
  useEffect(() => {
    if (!pathname) return;

    if (isBackActionRef.current) {
      isBackActionRef.current = false;
      return;
    }

    const hist = historyRef.current;
    if (hist.length === 0 || hist[hist.length - 1] !== pathname) {
      hist.push(pathname);
      if (hist.length > 40) {
        hist.shift();
      }
    }
  }, [pathname]);

  // Interceptar botón atrás de Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      const isRootScreen = pathname === '/' || pathname === '/index' || pathname === '/login';

      // 1. Si tenemos historial de pantallas previas acumulado
      if (historyRef.current.length > 1) {
        historyRef.current.pop(); // Remover la ruta actual
        const previousPath = historyRef.current[historyRef.current.length - 1];
        if (previousPath && previousPath !== pathname) {
          isBackActionRef.current = true;
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace(previousPath as any);
          }
          return true; // Prevenir salida de la app
        }
      }

      // 2. Si el router tiene historial nativo pero no está en el ref
      if (!isRootScreen && router.canGoBack()) {
        isBackActionRef.current = true;
        router.back();
        return true;
      }

      // 3. Si no está en la raíz, regresar al inicio
      if (!isRootScreen) {
        historyRef.current = ['/'];
        isBackActionRef.current = true;
        router.replace('/');
        return true;
      }

      // 4. Si ya está en la pantalla principal (Home / Login), pedir confirmación
      Alert.alert(
        'Salir de la aplicación',
        '¿Estás seguro de que deseas salir de Paneador Pastoral?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Salir',
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ],
        { cancelable: true }
      );
      return true; // Bloquear cierre abrupto
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [pathname, router]);

  return null;
}

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
      <AndroidBackHandler />
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
