import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { MouseReportAbsolute } from '@/lib/mouse.ts';
import { client, MessageEvent } from '@/lib/websocket.ts';
import { scrollDirectionAtom, scrollIntervalAtom } from '@/jotai/mouse.ts';
import { videoParametersAtom } from '@/jotai/screen.ts';

import { MouseAbsoluteEvent } from './types.ts';

enum MouseButton {
  Left = 0,
  Middle = 1,
  Right = 2,
  Back = 3,
  Forward = 4
}

export const Absolute = () => {
  const scrollDirection = useAtomValue(scrollDirectionAtom);
  const scrollInterval = useAtomValue(scrollIntervalAtom);
  const setVideoParameters = useSetAtom(videoParametersAtom);
  const currentVideoParams = useAtomValue(videoParametersAtom);

  const mouseRef = useRef(new MouseReportAbsolute());
  const lastPosRef = useRef({ x: 0.5, y: 0.5 });
  const lastScrollTimeRef = useRef(0);

  // Single-touch state
  const touchStartTimeRef = useRef(0);
  const lastTouchYRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const hasMoveRef = useRef(false);
  const isDraggingRef = useRef(false);
  const pressedButtonRef = useRef<MouseButton | null>(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  // Pinch-to-zoom state
  const isPinchingRef = useRef(false);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const pinchStartMidRef = useRef({ x: 0, y: 0 });
  const pinchStartPanRef = useRef({ x: 0, y: 0 });

  // Mirror atom values into a ref so handlers can read them without being in effect deps
  const videoParamsRef = useRef({ scale: 1, panX: 0, panY: 0 });
  videoParamsRef.current = {
    scale: currentVideoParams.scale,
    panX: currentVideoParams.panX ?? 0,
    panY: currentVideoParams.panY ?? 0
  };

  const TAP_THRESHOLD = 8;
  const DRAG_THRESHOLD = 10;
  const VELOCITY_THRESHOLD = 0.3;

  useEffect(() => {
    const screen = document.getElementById('screen') as HTMLVideoElement;
    if (!screen) return;

    screen.addEventListener('mousedown', handleMouseDown);
    screen.addEventListener('mouseup', handleMouseUp);
    screen.addEventListener('mousemove', handleMouseMove);
    screen.addEventListener('wheel', handleWheel);
    screen.addEventListener('click', disableEvent);
    screen.addEventListener('contextmenu', disableEvent);
    screen.addEventListener('touchstart', handleTouchStart, { passive: false });
    screen.addEventListener('touchmove', handleTouchMove, { passive: false });
    screen.addEventListener('touchend', handleTouchEnd, { passive: false });
    screen.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    function handleMouseDown(e: MouseEvent) {
      disableEvent(e);
      handleMouseEvent({ type: 'mousedown', button: e.button });
    }

    function handleMouseUp(e: MouseEvent) {
      disableEvent(e);
      handleMouseEvent({ type: 'mouseup', button: e.button });
    }

    function handleMouseMove(e: MouseEvent) {
      disableEvent(e);
      const { x, y } = getCoordinate(e);
      handleMouseEvent({ type: 'move', x, y });
    }

    function handleWheel(e: WheelEvent) {
      disableEvent(e);

      if (Math.floor(e.deltaY) === 0) return;

      const currentTime = Date.now();
      if (currentTime - lastScrollTimeRef.current < scrollInterval) return;

      const deltaY = (e.deltaY > 0 ? 1 : -1) * scrollDirection;
      handleMouseEvent({ type: 'wheel', deltaY });
      lastScrollTimeRef.current = currentTime;
    }

    function handleTouchStart(e: TouchEvent) {
      disableEvent(e);

      if (e.touches.length === 0) return;

      // Second (or more) finger joined — start or update pinch
      if (e.touches.length >= 2) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        // Release any active single-touch drag
        if (isDraggingRef.current && pressedButtonRef.current !== null) {
          handleMouseEvent({ type: 'mouseup', button: pressedButtonRef.current });
        }
        isDraggingRef.current = false;
        pressedButtonRef.current = null;

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchStartDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        pinchStartScaleRef.current = videoParamsRef.current.scale;
        pinchStartMidRef.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2
        };
        pinchStartPanRef.current = {
          x: videoParamsRef.current.panX,
          y: videoParamsRef.current.panY
        };
        isPinchingRef.current = true;
        return;
      }

      // Single touch
      const touch = e.touches[0];

      touchStartTimeRef.current = Date.now();
      lastTouchYRef.current = touch.clientY;
      isLongPressRef.current = false;
      hasMoveRef.current = false;
      isDraggingRef.current = false;
      isPinchingRef.current = false;
      pressedButtonRef.current = null;
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }

      const { x, y } = getCoordinate(touch);
      handleMouseEvent({ type: 'move', x, y });

      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        pressedButtonRef.current = MouseButton.Right;
        if (navigator.vibrate) navigator.vibrate(50);
        handleMouseEvent({ type: 'mousedown', button: MouseButton.Right });
      }, 800);
    }

    function handleTouchMove(e: TouchEvent) {
      disableEvent(e);

      if (e.touches.length === 0) return;

      // Two-finger: pinch zoom + pan
      if (e.touches.length >= 2) {
        isPinchingRef.current = true;

        const t1 = e.touches[0];
        const t2 = e.touches[1];

        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const currentMidX = (t1.clientX + t2.clientX) / 2;
        const currentMidY = (t1.clientY + t2.clientY) / 2;

        const S0 = pinchStartScaleRef.current;
        const ratio = currentDist / pinchStartDistRef.current;
        const S1 = Math.max(0.5, Math.min(4, S0 * ratio));

        // Keep the pinch origin fixed: the content point at the initial midpoint
        // should remain at the current midpoint after the transform changes.
        // Formula: tx1 = M_x - halfW - (M0_x - halfW - tx0) * S1/S0
        const halfW = window.innerWidth / 2;
        const halfH = window.innerHeight / 2;
        const scaleRatio = S1 / S0;
        const tx1 =
          currentMidX - halfW - (pinchStartMidRef.current.x - halfW - pinchStartPanRef.current.x) * scaleRatio;
        const ty1 =
          currentMidY - halfH - (pinchStartMidRef.current.y - halfH - pinchStartPanRef.current.y) * scaleRatio;

        setVideoParameters((prev) => ({ ...prev, scale: S1, panX: tx1, panY: ty1 }));
        return;
      }

      // Single touch — skip if we were just pinching
      if (isPinchingRef.current) return;

      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      const timeDelta = Date.now() - touchStartTimeRef.current;
      const velocity = timeDelta > 0 ? distance / timeDelta : 0;

      const shouldStartDrag =
        distance > DRAG_THRESHOLD || (distance > TAP_THRESHOLD && velocity > VELOCITY_THRESHOLD);

      if (shouldStartDrag && !isDraggingRef.current && !isLongPressRef.current) {
        if (!hasMoveRef.current) hasMoveRef.current = true;

        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        if (pressedButtonRef.current === null) {
          isDraggingRef.current = true;
          pressedButtonRef.current = MouseButton.Left;
          handleMouseEvent({ type: 'mousedown', button: MouseButton.Left });
        }
      }

      if (distance > TAP_THRESHOLD && !hasMoveRef.current) {
        hasMoveRef.current = true;
      }

      if (isDraggingRef.current || isLongPressRef.current) {
        const { x, y } = getCoordinate(touch);
        handleMouseEvent({ type: 'move', x, y });
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      disableEvent(e);

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Pinch: one finger remaining or all lifted
      if (isPinchingRef.current) {
        if (e.touches.length === 0) {
          isPinchingRef.current = false;
          // Snap back to scale 1 if close enough
          const { scale } = videoParamsRef.current;
          if (scale > 0.8 && scale < 1.1) {
            setVideoParameters((prev) => ({ ...prev, scale: 1, panX: 0, panY: 0 }));
          }
        }
        return;
      }

      if (!hasMoveRef.current && !isLongPressRef.current) {
        handleMouseEvent({ type: 'mousedown', button: MouseButton.Left });
        setTimeout(() => {
          handleMouseEvent({ type: 'mouseup', button: MouseButton.Left });
        }, 50);
      } else if (pressedButtonRef.current !== null) {
        handleMouseEvent({ type: 'mouseup', button: pressedButtonRef.current! });
      }

      isLongPressRef.current = false;
      hasMoveRef.current = false;
      isDraggingRef.current = false;
      pressedButtonRef.current = null;
    }

    function handleTouchCancel(e: any) {
      disableEvent(e);

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (isPinchingRef.current) {
        isPinchingRef.current = false;
        return;
      }

      if (pressedButtonRef.current) {
        handleMouseEvent({ type: 'mouseup', button: pressedButtonRef.current! });
      }

      isLongPressRef.current = false;
      hasMoveRef.current = false;
      isDraggingRef.current = false;
      pressedButtonRef.current = null;
    }

    function getCoordinate(event: any) {
      const { x, y } = getCorrectedCoords(event.clientX, event.clientY);

      const finalX = Math.max(0, Math.min(1, x));
      const finalY = Math.max(0, Math.min(1, y));

      const hexX = Math.floor(0x7fff * finalX) + 0x0001;
      const hexY = Math.floor(0x7fff * finalY) + 0x0001;

      return { x: hexX, y: hexY };
    }

    function getCorrectedCoords(clientX: number, clientY: number) {
      const rect = screen.getBoundingClientRect();

      if (!screen.videoWidth || !screen.videoHeight) {
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        return { x, y };
      }

      const videoRatio = screen.videoWidth / screen.videoHeight;
      const elementRatio = rect.width / rect.height;

      let renderedWidth = rect.width;
      let renderedHeight = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (videoRatio > elementRatio) {
        renderedHeight = rect.width / videoRatio;
        offsetY = (rect.height - renderedHeight) / 2;
      } else {
        renderedWidth = rect.height * videoRatio;
        offsetX = (rect.width - renderedWidth) / 2;
      }

      const x = (clientX - rect.left - offsetX) / renderedWidth;
      const y = (clientY - rect.top - offsetY) / renderedHeight;

      return { x, y };
    }

    return () => {
      screen.removeEventListener('mousemove', handleMouseMove);
      screen.removeEventListener('mousedown', handleMouseDown);
      screen.removeEventListener('mouseup', handleMouseUp);
      screen.removeEventListener('wheel', handleWheel);
      screen.removeEventListener('click', disableEvent);
      screen.removeEventListener('contextmenu', disableEvent);
      screen.removeEventListener('touchstart', handleTouchStart);
      screen.removeEventListener('touchmove', handleTouchMove);
      screen.removeEventListener('touchend', handleTouchEnd);
      screen.removeEventListener('touchcancel', handleTouchCancel);

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [scrollDirection, scrollInterval, setVideoParameters]);

  function handleMouseEvent(event: MouseAbsoluteEvent) {
    let report: Uint8Array;
    const mouse = mouseRef.current;

    switch (event.type) {
      case 'mousedown':
        mouse.buttonDown(event.button);
        report = mouse.buildButtonReport(lastPosRef.current.x, lastPosRef.current.y);
        break;
      case 'mouseup':
        mouse.buttonUp(event.button);
        report = mouse.buildButtonReport(lastPosRef.current.x, lastPosRef.current.y);
        break;
      case 'wheel':
        report = mouse.buildReport(lastPosRef.current.x, lastPosRef.current.y, event.deltaY);
        break;
      case 'move':
        report = mouse.buildReport(event.x, event.y);
        lastPosRef.current = { x: event.x, y: event.y };
        break;
      default:
        report = mouse.buildReport(lastPosRef.current.x, lastPosRef.current.y);
        break;
    }

    sendReport(report);
  }

  function sendReport(report: Uint8Array) {
    const data = new Uint8Array([MessageEvent.Mouse, ...report]);
    client.send(data);
  }

  function disableEvent(event: any) {
    event.preventDefault();
    event.stopPropagation();
  }

  return <></>;
};
