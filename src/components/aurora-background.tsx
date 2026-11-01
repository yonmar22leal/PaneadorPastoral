import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export interface AuroraBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blurIntensity?: number;
}

export function AuroraBackground({ children, style }: AuroraBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      {/* 
        FONDO DE MALLA AURORA GAUSSIANA REAL
        Textura 100% nativa con difuminado suave sin bordes circulares,
        sin cortes cuadrados y con máximo rendimiento a 60 FPS en Android y Web.
      */}
      <Image
        source={require('../../assets/images/aurora-glow.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority="high"
        cachePolicy="memory-disk"
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
