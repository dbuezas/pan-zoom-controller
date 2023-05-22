// js version generated from https://github.com/dbuezas/pan-zoom-controller/blob/main/src/digital-ptz.ts

import { Transform } from "./ditigal-ptz.transform";

const ONE_FINGER_ZOOM_SPEED = 1 / 200; // 1 scale every 200px
const DBL_CLICK_MS = 250;
const MAX_ZOOM = 10;

const DEFAULT_OPTIONS = {
  mouse_drag_pan: true,
  mouse_wheel_zoom: true,
  mouse_double_click_zoom: true,
  touch_tap_drag_zoom: true,
  touch_drag_pan: true,
  touch_pinch_zoom: true,
  touch_double_tap_zoom: true,
  persist_key: "",
  persist: true,
};

type Options = {
  mouse_drag_pan?: boolean;
  mouse_wheel_zoom?: boolean;
  mouse_double_click_zoom?: boolean;
  touch_tap_drag_zoom?: boolean;
  touch_drag_pan?: boolean;
  touch_pinch_zoom?: boolean;
  touch_double_tap_zoom?: boolean;
  persist_key: string;
  persist: boolean;
};

const captureEvent = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
};

export class DigitalPTZ {
  lastTouches?: TouchList;
  lastMouse?: MouseEvent;
  lastTap = 0;
  containerEl: HTMLElement;
  videoEl: HTMLVideoElement;
  resizeObserver: ResizeObserver;
  transform: Transform;
  options: Options;

  constructor(
    containerEl: HTMLElement,
    videoEl: HTMLVideoElement,
    options?: Options
  ) {
    this.containerEl = containerEl;
    this.videoEl = videoEl;
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.transform = new Transform({
      persist_key: this.options.persist_key,
      persist: this.options.persist,
      maxZoom: MAX_ZOOM,
    });
    for (const [event, handler] of this.handlers) {
      this.containerEl.addEventListener(event, handler as any, {
        capture: true,
      });
    }
    this.videoEl.addEventListener("loadedmetadata", this.recomputeRects);
    this.resizeObserver = new ResizeObserver(this.recomputeRects);
    this.resizeObserver.observe(this.containerEl);
    this.recomputeRects();
  }

  private recomputeRects = () => {
    this.transform.updateRects(this.videoEl, this.containerEl);
    this.transform.zoomAtCoords(1, 0, 0); // clamp transform
    this.render();
  };
  destroy() {
    for (const [event, handler] of this.handlers) {
      this.containerEl.removeEventListener(event, handler as any);
    }
    this.videoEl.removeEventListener("loadedmetadata", this.recomputeRects);
    this.resizeObserver.unobserve(this.containerEl);
  }

  private startTouchTapDragZoom(downEvent: TouchEvent, isDoubleTap: boolean) {
    const relevant = downEvent.touches.length === 1 && isDoubleTap;
    captureEvent(downEvent);
    if (!relevant) return false;
    let lastTouchY = downEvent.touches[0].clientY;
    const onTouchMove = (moveEvent: TouchEvent) => {
      captureEvent(moveEvent);
      const currTouchY = moveEvent.touches[0].clientY;
      this.transform.zoom(
        1 - (lastTouchY - currTouchY) * ONE_FINGER_ZOOM_SPEED
      );
      lastTouchY = currTouchY;
      this.render();
    };

    this.containerEl.addEventListener("touchmove", onTouchMove);
    const onTouchEnd = () =>
      this.containerEl.removeEventListener("touchmove", onTouchMove);
    this.containerEl.addEventListener("touchend", onTouchEnd, { once: true });
    return true;
  }
  private startDoubleTapZoom(downEvent: TouchEvent, isDoubleTap: boolean) {
    const relevant = downEvent.touches.length === 1 && isDoubleTap;
    if (!relevant) return false;
    this.containerEl.addEventListener(
      "touchend",
      (endEvent: TouchEvent) => {
        captureEvent(endEvent);
        const isQuickRelease = endEvent.timeStamp - this.lastTap < DBL_CLICK_MS;
        if (!isQuickRelease) return;
        if (this.transform.scale == 1) {
          this.transform.zoomAtCoords(
            2,
            downEvent.touches[0].clientX,
            downEvent.touches[0].clientY
          );
        } else {
          this.transform.zoomAtCoords(0.01, 0, 0);
        }
        this.render();
      },
      { once: true }
    );
    captureEvent(downEvent);
    return true;
  }

  private startOneFingerPan(downEvent: TouchEvent, isDoubleTap: boolean) {
    const relevant = downEvent.touches.length === 1 && !isDoubleTap;
    if (!relevant) return false;

    let lastTouches = downEvent.touches;
    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      captureEvent(moveEvent);
      const dx = moveEvent.touches[0].clientX - lastTouches[0].clientX;
      const dy = moveEvent.touches[0].clientY - lastTouches[0].clientY;
      this.transform.move(dx, dy);
      lastTouches = moveEvent.touches;
      this.render();
    };
    this.containerEl.addEventListener("touchmove", onTouchMove);
    const onTouchEnd = () =>
      this.containerEl.removeEventListener("touchmove", onTouchMove);
    this.containerEl.addEventListener("touchend", onTouchEnd, { once: true });
    captureEvent(downEvent);
    return true;
  }
  private startPinchZoom(downEvent: TouchEvent, isDoubleTap: boolean) {
    const relevant = downEvent.touches.length === 2;
    if (!relevant) return false;
    captureEvent(downEvent);

    let lastTouches = downEvent.touches;
    const onTouchMove = (moveEvent: TouchEvent) => {
      captureEvent(moveEvent);
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
      this.transform.move(dx, dy);
      this.transform.zoomAtCoords(zoom, newCenter.x, newCenter.y);
      lastTouches = moveEvent.touches;
      this.render();
    };
    this.containerEl.addEventListener("touchmove", onTouchMove);
    const onTouchEnd = () =>
      this.containerEl.removeEventListener("touchmove", onTouchMove);
    this.containerEl.addEventListener("touchend", onTouchEnd, { once: true });
    return true;
  }
  private onTouchStart = (downEvent: TouchEvent) => {
    const isDoubleTap = downEvent.timeStamp - this.lastTap < DBL_CLICK_MS;
    this.lastTap = downEvent.timeStamp;

    if (this.options.touch_tap_drag_zoom)
      this.startTouchTapDragZoom(downEvent, isDoubleTap);
    if (this.options.touch_drag_pan)
      this.startOneFingerPan(downEvent, isDoubleTap);
    if (this.options.touch_double_tap_zoom)
      this.startDoubleTapZoom(downEvent, isDoubleTap);
    if (this.options.touch_pinch_zoom)
      this.startPinchZoom(downEvent, isDoubleTap);
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.options.mouse_wheel_zoom) return;
    captureEvent(e);
    const zoom = 1 - e.deltaY / 1000;
    this.transform.zoomAtCoords(zoom, e.clientX, e.clientY);
    this.render();
  };

  private startDoubleClickZoom(downEvent: MouseEvent, isDoubleTap: boolean) {
    if (!isDoubleTap) return false;
    captureEvent(downEvent);
    this.containerEl.addEventListener(
      "mouseup",
      (upEvent: MouseEvent) => {
        captureEvent(upEvent);
        const isQuickRelease = upEvent.timeStamp - this.lastTap < DBL_CLICK_MS;
        if (!isQuickRelease) return;
        if (this.transform.scale == 1) {
          this.transform.zoomAtCoords(2, downEvent.clientX, downEvent.clientY);
        } else {
          this.transform.zoomAtCoords(0.01, 0, 0);
        }
        this.render();
      },
      { once: true }
    );
    return true;
  }

  private startMouseDragPan(downEvent: MouseEvent, isDoubleTap: boolean) {
    if (isDoubleTap) return false;
    captureEvent(downEvent);
    let lastMouse = downEvent;
    const onMouseMove = (moveEvent: MouseEvent) => {
      captureEvent(moveEvent);
      const dx = moveEvent.x - lastMouse.x;
      const dy = moveEvent.y - lastMouse.y;
      this.transform.move(dx, dy);
      lastMouse = moveEvent;
      this.render();
    };
    this.containerEl.addEventListener("mousemove", onMouseMove);
    this.containerEl.addEventListener(
      "mouseup",
      () => this.containerEl.removeEventListener("mousemove", onMouseMove),
      { once: true }
    );
    return true;
  }

  private onMouseDown = (downEvent: MouseEvent) => {
    const isDoubleTap = downEvent.timeStamp - this.lastTap < DBL_CLICK_MS;
    this.lastTap = downEvent.timeStamp;

    if (this.options.mouse_double_click_zoom)
      this.startDoubleClickZoom(downEvent, isDoubleTap);
    if (this.options.mouse_drag_pan)
      this.startMouseDragPan(downEvent, isDoubleTap);
  };

  private handlers = [
    ["wheel", this.onWheel],
    ["touchstart", this.onTouchStart],
    ["mousedown", this.onMouseDown],
  ] as const;

  private render() {
    this.videoEl.style.transform = this.transform.render();
  }
}
