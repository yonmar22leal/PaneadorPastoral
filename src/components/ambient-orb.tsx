import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export interface AmbientOrbProps {
  color: string; // e.g. "37, 99, 235"
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  maxOpacity?: number;
}

export function AmbientOrb({
  color,
  size,
  top,
  bottom,
  left,
  right,
  maxOpacity = 0.5,
}: AmbientOrbProps) {
  const midSize = Math.round(size * 0.72);
  const innerSize = Math.round(size * 0.44);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.orbContainer,
        {
          width: size,
          height: size,
          top,
          bottom,
          left,
          right,
        },
      ]}>
      {/* 
        MALLA DE DIFUSIÓN MULTI-EJE RADIAL (SIN BORDES DUROS EN ANDROID/IOS)
        Todos los gradientes inician y terminan en alpha 0 (completamente transparentes) 
        en sus extremos para evitar bordes circulares recortados.
      */}

      {/* 1. Halo Exterior Amplio (Eje Vertical) */}
      <LinearGradient
        colors={[`rgba(${color}, 0)`, `rgba(${color}, ${maxOpacity * 0.35})`, `rgba(${color}, 0)`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.glowLayer, { width: size, height: size }]}
      />

      {/* 2. Halo Exterior Amplio (Eje Horizontal) */}
      <LinearGradient
        colors={[`rgba(${color}, 0)`, `rgba(${color}, ${maxOpacity * 0.35})`, `rgba(${color}, 0)`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.glowLayer, { width: size, height: size }]}
      />

      {/* 3. Halo Diagonal Suave 1 */}
      <LinearGradient
        colors={[`rgba(${color}, 0)`, `rgba(${color}, ${maxOpacity * 0.22})`, `rgba(${color}, 0)`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={[styles.glowLayer, { width: size, height: size }]}
      />

      {/* 4. Halo Diagonal Suave 2 */}
      <LinearGradient
        colors={[`rgba(${color}, 0)`, `rgba(${color}, ${maxOpacity * 0.22})`, `rgba(${color}, 0)`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.9, y: 0.1 }}
        end={{ x: 0.1, y: 0.9 }}
        style={[styles.glowLayer, { width: size, height: size }]}
      />

      {/* 5. Capa Media Concentrada (Eje Vertical) */}
      <LinearGradient
        colors={[`rgba(${color}, 0)`, `rgba(${color}, ${maxOpacity * 0.55})`, `rgba(${color}, 0)`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.glowLayer,
          {
            width: midSize,
            height: midSize,
            top: (size - midSize) / 2,
            left: (size - midSize) / 2,
          },
        ]}
      />

      {/* 6. Capa Media Concentrada (Eje Horizontal) */}
      <LinearGradient
        colors={[`rgba(${color}, 0)`, `rgba(${color}, ${maxOpacity * 0.55})`, `rgba(${color}, 0)`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.glowLayer,
          {
            width: midSize,
            height: midSize,
            top: (size - midSize) / 2,
            left: (size - midSize) / 2,
          },
        ]}
      />

      {/* 7. Núcleo Brillante Central Difuminado */}
      <LinearGradient
        colors={[`rgba(${color}, 0)`, `rgba(${color}, ${maxOpacity})`, `rgba(${color}, 0)`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.glowLayer,
          {
            width: innerSize,
            height: innerSize,
            top: (size - innerSize) / 2,
            left: (size - innerSize) / 2,
          },
        ]}
      />
      <LinearGradient
        colors={[`rgba(${color}, 0)`, `rgba(${color}, ${maxOpacity})`, `rgba(${color}, 0)`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.glowLayer,
          {
            width: innerSize,
            height: innerSize,
            top: (size - innerSize) / 2,
            left: (size - innerSize) / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orbContainer: {
    position: 'absolute',
    ...Platform.select({
      web: {
        filter: 'blur(80px)',
      },
    }),
  },
  glowLayer: {
    position: 'absolute',
  },
});
