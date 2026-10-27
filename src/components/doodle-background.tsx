import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  ViewStyle,
  StyleProp,
  ImageStyle,
} from 'react-native';

export interface DoodleBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  opacity?: number;
  dark?: boolean;
}

export function DoodleBackground({
  children,
  style,
  imageStyle,
  opacity,
  dark = false,
}: DoodleBackgroundProps) {
  const source = dark
    ? require('@/assets/images/doodle-pattern-dark.png')
    : require('@/assets/images/doodle-pattern-light.png');

  const defaultOpacity = dark ? 0.22 : 0.15;

  return (
    <ImageBackground
      source={source}
      style={[styles.background, style]}
      imageStyle={[{ opacity: opacity ?? defaultOpacity }, imageStyle]}
      resizeMode="repeat"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
