import { useRef, useState, useCallback } from "react";

interface SwipeOptions {
  threshold?: number;        // px to trigger
  maxOffAxis?: number;       // ignore vertical-dominant gestures
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Touch swipe handler returning live drag offset for translate animations.
 * Only horizontal swipes are tracked; vertical scrolling is preserved.
 */
export function useSwipe({ threshold = 80, maxOffAxis = 40, onSwipeLeft, onSwipeRight }: SwipeOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    tracking.current = true;
    setDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!tracking.current) return;
    const t = e.touches[0];
    const x = t.clientX - startX.current;
    const y = t.clientY - startY.current;
    if (Math.abs(y) > Math.abs(x) && Math.abs(y) > maxOffAxis) {
      // user is scrolling vertically — abort horizontal tracking
      tracking.current = false;
      setDx(0);
      setDragging(false);
      return;
    }
    setDx(x);
  }, [maxOffAxis]);

  const onTouchEnd = useCallback(() => {
    if (!tracking.current) {
      setDragging(false);
      setDx(0);
      return;
    }
    tracking.current = false;
    setDragging(false);
    if (dx <= -threshold) onSwipeLeft?.();
    else if (dx >= threshold) onSwipeRight?.();
    setDx(0);
  }, [dx, threshold, onSwipeLeft, onSwipeRight]);

  return {
    dx,
    dragging,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  };
}

export default useSwipe;