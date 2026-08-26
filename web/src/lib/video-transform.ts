import type { CSSProperties } from 'react';

import { VideoRotation } from '@/types';

export function isQuarterTurn(rotation: VideoRotation) {
  return rotation === 90 || rotation === 270;
}

export function getScreenElement() {
  const screen = document.getElementById('screen');
  return screen?.querySelector('img') ?? screen;
}

export function getVideoRotationStyle(
  scale: number,
  rotation: VideoRotation,
  panX = 0,
  panY = 0
): CSSProperties {
  return {
    transform: `translate(${panX}px, ${panY}px) scale(${scale}) rotate(${rotation}deg)`,
    transformOrigin: 'center'
  };
}

export function getVideoSizeStyle(rotation: VideoRotation): CSSProperties {
  const quarterTurn = isQuarterTurn(rotation);

  return {
    minWidth: quarterTurn ? 'min(50vw, 100vh)' : undefined,
    minHeight: quarterTurn ? 'min(50vh, 100vw)' : undefined,
    maxWidth: quarterTurn ? '100vh' : '100vw',
    maxHeight: quarterTurn ? '100vw' : '100vh'
  };
}

export function getVideoTransformStyle(
  scale: number,
  rotation: VideoRotation,
  panX = 0,
  panY = 0
): CSSProperties {
  return {
    ...getVideoRotationStyle(scale, rotation, panX, panY),
    ...getVideoSizeStyle(rotation)
  };
}

export function inverseRotatePoint(x: number, y: number, rotation: VideoRotation) {
  switch (rotation) {
    case 90:
      return { x: y, y: 1 - x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: 1 - y, y: x };
    default:
      return { x, y };
  }
}

export function inverseRotateDelta(x: number, y: number, rotation: VideoRotation) {
  switch (rotation) {
    case 90:
      return { x: y, y: -x };
    case 180:
      return { x: -x, y: -y };
    case 270:
      return { x: -y, y: x };
    default:
      return { x, y };
  }
}
