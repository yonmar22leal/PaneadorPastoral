import { Image } from 'expo-image';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

export interface DoodleBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  imageStyle?: any;
  opacity?: number;
  dark?: boolean;
}

export function DoodleBackground({
  children,
  style,
  dark = true,
}: DoodleBackgroundProps) {
  if (!dark) {
    return (
      <View style={[styles.container, { backgroundColor: '#F8FAFC' }, style]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* FONDO AURORA GAUSSIANO ULTRA-SUAVE */}
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
    width: '100%',
    height: '100%',
  },
});
