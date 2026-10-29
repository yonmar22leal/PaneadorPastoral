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
  const half = size / 2;
  const midSize = Math.round(size * 0.72);
  const midHalf = midSize / 2;
  const innerSize = Math.round(size * 0.45);
  const innerHalf = innerSize / 2;

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
      {/* Capa 1: Halo exterior amplio y ultra-suave que se desvanece a 0 */}
      <LinearGradient
        colors={[
          `rgba(${color}, ${maxOpacity * 0.35})`,
          `rgba(${color}, ${maxOpacity * 0.12})`,
          `rgba(${color}, 0)`,
        ]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.glowLayer,
          {
            width: size,
            height: size,
            borderRadius: half,
          },
        ]}
      />

      {/* Capa 2: Gradiente medio cruzado para volumen esférico */}
      <LinearGradient
        colors={[
          `rgba(${color}, ${maxOpacity * 0.6})`,
          `rgba(${color}, ${maxOpacity * 0.22})`,
          `rgba(${color}, 0)`,
        ]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.35, y: 0.35 }}
        end={{ x: 0.95, y: 0.95 }}
        style={[
          styles.glowLayer,
          {
            width: midSize,
            height: midSize,
            borderRadius: midHalf,
            top: (size - midSize) / 2,
            left: (size - midSize) / 2,
          },
        ]}
      />

      {/* Capa 3: Núcleo de luz difuminado */}
      <LinearGradient
        colors={[
          `rgba(${color}, ${maxOpacity})`,
          `rgba(${color}, ${maxOpacity * 0.35})`,
          `rgba(${color}, 0)`,
        ]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.glowLayer,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerHalf,
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
        filter: 'blur(75px)',
      },
    }),
  },
  glowLayer: {
    position: 'absolute',
  },
});
