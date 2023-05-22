// js version generated from https://github.com/dbuezas/pan-zoom-controller/blob/main/src/digital-ptz.ts

import {
  onWheel,
  startDoubleClickZoom,
  startDoubleTapZoom,
  startMouseDragPan,
  startOneFingerPan,
  startPinchZoom,
  startTouchTapDragZoom,
} from "./digital-ptz.gestures";
import { Transform } from "./ditigal-ptz.transform";

export const ONE_FINGER_ZOOM_SPEED = 1 / 200; // 1 scale every 200px
export const DBL_CLICK_MS = 250;
export const MAX_ZOOM = 10;

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

export class DigitalPTZ {
  lastTouches?: TouchList;
  lastMouse?: MouseEvent;
  lastTap = 0;
  containerEl: HTMLElement;
  videoEl: HTMLVideoElement;
  resizeObserver: ResizeObserver;
  transform: Transform;
  options: Options;
  handles: Function[] = [];

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
    });

    this.videoEl.addEventListener("loadedmetadata", this.recomputeRects);
    this.resizeObserver = new ResizeObserver(this.recomputeRects);
    this.resizeObserver.observe(this.containerEl);

    const o = this.options;
    const gestureParam = {
      containerEl,
      transform: this.transform,
      render: this.render,
    };
    const h = this.handles;
    if (o.mouse_drag_pan) h.push(startMouseDragPan(gestureParam));
    if (o.mouse_wheel_zoom) h.push(onWheel(gestureParam));
    if (o.mouse_double_click_zoom) h.push(startDoubleClickZoom(gestureParam));
    if (o.touch_double_tap_zoom) h.push(startDoubleTapZoom(gestureParam));
    if (o.touch_tap_drag_zoom) h.push(startTouchTapDragZoom(gestureParam));
    if (o.touch_drag_pan) h.push(startOneFingerPan(gestureParam));
    if (o.touch_pinch_zoom) h.push(startPinchZoom(gestureParam));

    this.recomputeRects();
  }

  private recomputeRects = () => {
    this.transform.updateRects(this.videoEl, this.containerEl);
    this.transform.zoomAtCoords(1, 0, 0); // clamp transform
    this.render();
  };

  destroy() {
    for (const off of this.handles) off();
    this.videoEl.removeEventListener("loadedmetadata", this.recomputeRects);
    this.resizeObserver.unobserve(this.containerEl);
  }

  private render = () => {
    this.videoEl.style.transform = this.transform.render();
  };
}
