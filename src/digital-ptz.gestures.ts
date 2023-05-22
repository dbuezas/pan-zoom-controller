import { DBL_CLICK_MS, ONE_FINGER_ZOOM_SPEED } from "./digital-ptz";
import { Transform } from "./ditigal-ptz.transform";
const capture = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
};

type GestureParam = {
  containerEl: HTMLElement;
  transform: Transform;
  render: () => void;
};

export function startDoubleTapZoom({
  containerEl,
  transform,
  render,
}: GestureParam) {
  let lastTap = 0;
  const onTouchStart = (downEvent: TouchEvent) => {
    const isSecondTap = downEvent.timeStamp - lastTap < DBL_CLICK_MS;
    lastTap = downEvent.timeStamp;

    const relevant = downEvent.touches.length === 1 && isSecondTap;
    if (!relevant) return;
    const onTouchEnd = (endEvent: TouchEvent) => {
      const isQuickRelease = endEvent.timeStamp - lastTap < DBL_CLICK_MS;
      if (!isQuickRelease) return;
      const zoom = transform.scale == 1 ? 2 : 0.01;
      transform.zoomAtCoords(
        zoom,
        downEvent.touches[0].clientX,
        downEvent.touches[0].clientY
      );
      render();
    };
    containerEl.addEventListener("touchend", onTouchEnd, { once: true });
  };
  containerEl.addEventListener("touchstart", onTouchStart);
  return () => containerEl.removeEventListener("touchstart", onTouchStart);
}

export function startOneFingerPan({
  containerEl,
  transform,
  render,
}: GestureParam) {
  const onTouchStart = (downEvent: TouchEvent) => {
    if (downEvent.touches.length !== 1) return;
    let lastTouches = downEvent.touches;
    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      capture(moveEvent);
      const dx = moveEvent.touches[0].clientX - lastTouches[0].clientX;
      const dy = moveEvent.touches[0].clientY - lastTouches[0].clientY;
      transform.move(dx, dy);
      lastTouches = moveEvent.touches;
      render();
    };
    containerEl.addEventListener("touchmove", onTouchMove);
    const onTouchEnd = () =>
      containerEl.removeEventListener("touchmove", onTouchMove);
    containerEl.addEventListener("touchend", onTouchEnd, { once: true });
    capture(downEvent);
    return true;
  };
  containerEl.addEventListener("touchstart", onTouchStart);
  return () => containerEl.removeEventListener("touchstart", onTouchStart);
}

export function startPinchZoom({
  containerEl,
  transform,
  render,
}: GestureParam) {
  const onTouchStart = (downEvent: TouchEvent) => {
    const relevant = downEvent.touches.length === 2;
    if (!relevant) return false;

    let lastTouches = downEvent.touches;
    const onTouchMove = (moveEvent: TouchEvent) => {
      capture(moveEvent);
      const oldCenter = {
        x: (lastTouches[0].clientX + lastTouches[1].clientX) / 2,
        y: (lastTouches[0].clientY + lastTouches[1].clientY) / 2,
      };
      const newTouches = moveEvent.touches;
      const newCenter = {
        x: (newTouches[0].clientX + newTouches[1].clientX) / 2,
        y: (newTouches[0].clientY + newTouches[1].clientY) / 2,
      };
      const dx = newCenter.x - oldCenter.x;
      const dy = newCenter.y - oldCenter.y;
      const oldSpread = Math.hypot(
        lastTouches[0].clientX - lastTouches[1].clientX,
        lastTouches[0].clientY - lastTouches[1].clientY
      );
      const newSpread = Math.hypot(
        newTouches[0].clientX - newTouches[1].clientX,
        newTouches[0].clientY - newTouches[1].clientY
      );
      const zoom = newSpread / oldSpread;
      transform.move(dx, dy);
      transform.zoomAtCoords(zoom, newCenter.x, newCenter.y);
      lastTouches = moveEvent.touches;
      render();
    };
    containerEl.addEventListener("touchmove", onTouchMove);
    const onTouchEnd = () =>
      containerEl.removeEventListener("touchmove", onTouchMove);
    containerEl.addEventListener("touchend", onTouchEnd, { once: true });
    return true;
  };
  containerEl.addEventListener("touchstart", onTouchStart);
  return () => containerEl.removeEventListener("touchstart", onTouchStart);
}

export function startTouchTapDragZoom({
  containerEl,
  transform,
  render,
}: GestureParam) {
  let lastTap = 0;
  const onTouchStart = (downEvent: TouchEvent) => {
    const isSecondTap = downEvent.timeStamp - lastTap < DBL_CLICK_MS;
    lastTap = downEvent.timeStamp;
    const relevant = downEvent.touches.length === 1 && isSecondTap;
    if (!relevant) return false;

    capture(downEvent);
    if (!relevant) return false;
    let lastTouchY = downEvent.touches[0].clientY;
    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length > 1) return;
      capture(moveEvent);
      const currTouchY = moveEvent.touches[0].clientY;
      transform.zoom(1 - (lastTouchY - currTouchY) * ONE_FINGER_ZOOM_SPEED);
      lastTouchY = currTouchY;
      render();
    };

    containerEl.addEventListener("touchmove", onTouchMove);
    const onTouchEnd = () =>
      containerEl.removeEventListener("touchmove", onTouchMove);
    containerEl.addEventListener("touchend", onTouchEnd, { once: true });
    return true;
  };
  containerEl.addEventListener("touchstart", onTouchStart);
  return () => containerEl.removeEventListener("touchstart", onTouchStart);
}

export function onWheel({ containerEl, transform, render }: GestureParam) {
  const onWheel = (e: WheelEvent) => {
    capture(e);
    const zoom = 1 - e.deltaY / 1000;
    transform.zoomAtCoords(zoom, e.clientX, e.clientY);
    render();
  };
  containerEl.addEventListener("wheel", onWheel);
  return () => containerEl.removeEventListener("wheel", onWheel);
}

export function startDoubleClickZoom({
  containerEl,
  transform,
  render,
}: GestureParam) {
  let lastClick = 0;
  const onMouseDown = (downEvent: MouseEvent) => {
    const isSecondClick = downEvent.timeStamp - lastClick < DBL_CLICK_MS;
    lastClick = downEvent.timeStamp;
    if (!isSecondClick) return false;
    capture(downEvent);
    containerEl.addEventListener(
      "mouseup",
      (upEvent: MouseEvent) => {
        const isQuickRelease = upEvent.timeStamp - lastClick < DBL_CLICK_MS;
        if (!isQuickRelease) return;
        const zoom = transform.scale == 1 ? 2 : 0.01;
        transform.zoomAtCoords(zoom, upEvent.clientX, upEvent.clientY);
        render();
      },
      { once: true }
    );
    return true;
  };
  containerEl.addEventListener("mousedown", onMouseDown);
  return () => containerEl.removeEventListener("mousedown", onMouseDown);
}

export function startMouseDragPan({
  containerEl,
  transform,
  render,
}: GestureParam) {
  let lastClick = 0;
  const onMouseDown = (downEvent: MouseEvent) => {
    lastClick = downEvent.timeStamp;
    capture(downEvent);
    let lastMouse = downEvent;
    let moved = false;
    const onMouseMove = (moveEvent: MouseEvent) => {
      moved = true;
      capture(moveEvent);
      const dx = moveEvent.x - lastMouse.x;
      const dy = moveEvent.y - lastMouse.y;
      transform.move(dx, dy);
      lastMouse = moveEvent;
      render();
    };
    containerEl.addEventListener("mousemove", onMouseMove);
    containerEl.addEventListener(
      "mouseup",
      (e) => {
        containerEl.removeEventListener("mousemove", onMouseMove);
        if (moved) capture(e);
        console.log(`moved`, moved);
      },
      { once: true }
    );
    return true;
  };
  containerEl.addEventListener("mousedown", onMouseDown);
  return () => containerEl.removeEventListener("mousedown", onMouseDown);
}
