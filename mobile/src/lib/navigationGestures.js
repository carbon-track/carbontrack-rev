import React from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

const EDGE_WIDTH = 34;
const ACTIVATE_DX = 4;
const MAX_VERTICAL_DRIFT = 24;

export function useEdgeSwipeBack(navigation) {
  const translateX = React.useRef(new Animated.Value(0)).current;

  const panHandlers = React.useMemo(() => PanResponder.create({
    onPanResponderGrant: () => {
      translateX.stopAnimation();
    },
    onMoveShouldSetPanResponder: (event, gestureState) => {
      const startX = event.nativeEvent.pageX ?? event.nativeEvent.locationX ?? 0;
      return startX <= EDGE_WIDTH
        && gestureState.dx > ACTIVATE_DX
        && Math.abs(gestureState.dy) < MAX_VERTICAL_DRIFT;
    },
    onPanResponderMove: (_, gestureState) => {
      const width = Dimensions.get('window').width || 360;
      translateX.setValue(Math.max(0, Math.min(gestureState.dx, width)));
    },
    onPanResponderRelease: (_, gestureState) => {
      const width = Dimensions.get('window').width || 360;
      if (gestureState.dx > width / 2) {
        Animated.timing(translateX, {
          duration: 160,
          toValue: width,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            navigation?.goBack?.();
          }
          translateX.setValue(0);
        });
        return;
      }
      Animated.spring(translateX, {
        damping: 18,
        mass: 0.7,
        stiffness: 210,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, {
        damping: 18,
        mass: 0.7,
        stiffness: 210,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderTerminationRequest: () => true,
  }).panHandlers, [navigation, translateX]);

  const animatedStyle = React.useMemo(() => ({
    transform: [{ translateX }],
  }), [translateX]);
  const backdropStyle = React.useMemo(() => ({
    opacity: translateX.interpolate({
      inputRange: [0, (Dimensions.get('window').width || 360) / 2],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
  }), [translateX]);

  return React.useMemo(() => ({ animatedStyle, backdropStyle, panHandlers }), [animatedStyle, backdropStyle, panHandlers]);
}
