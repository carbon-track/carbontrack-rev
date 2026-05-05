import React from 'react';
import { PanResponder } from 'react-native';

const EDGE_WIDTH = 34;
const ACTIVATE_DX = 16;
const MAX_VERTICAL_DRIFT = 24;
const COMMIT_DX = 74;
const COMMIT_VX = 0.48;

export function useEdgeSwipeBack(navigation) {
  return React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, gestureState) => {
      const startX = event.nativeEvent.pageX ?? event.nativeEvent.locationX ?? 0;
      return startX <= EDGE_WIDTH
        && gestureState.dx > ACTIVATE_DX
        && Math.abs(gestureState.dy) < MAX_VERTICAL_DRIFT;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > COMMIT_DX || gestureState.vx > COMMIT_VX) {
        navigation?.goBack?.();
      }
    },
  }).panHandlers, [navigation]);
}
