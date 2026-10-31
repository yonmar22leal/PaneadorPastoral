import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AmbientOrb } from './ambient-orb';

export interface AuroraBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blurIntensity?: number;
}

export function AuroraBackground({
  children,
  style,
  blurIntensity = Platform.OS === 'android' ? 60 : 80,
}: AuroraBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      {/* BASE DEGRADADO PRINCIPAL */}
      <LinearGradient
        colors={['#070A14', '#0A1128', '#060913', '#080E1A']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* LUCES AMBIENTALES MULTI-CAPA DIFUSAS (SIN BORDES DUROS EN ANDROID/IOS) */}
      <AmbientOrb color="37, 99, 235" size={380} top={30} right={-80} maxOpacity={0.48} />
      <AmbientOrb color="13, 148, 136" size={360} top={240} left={-100} maxOpacity={0.42} />
      <AmbientOrb color="225, 29, 72" size={360} top={480} right={-90} maxOpacity={0.38} />
      <AmbientOrb color="5, 150, 105" size={370} top={720} left={-90} maxOpacity={0.38} />

      {/* CAPA DE DESENFOQUE NATIVO (BLURVIEW) PARA SUAVIZAR EL CONJUNTO */}
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        blurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />

      {/* CONTENIDO HIJO */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#070A14',
  },
});
