// js version generated from https://github.com/dbuezas/pan-zoom-controller/blob/main/src/digital-ptz.ts

const ONE_FINGER_ZOOM_SPEED = 1 / 200; // 1 scale every 200px
const DBL_CLICK_MS = 400;
const MAX_ZOOM = 10;

const DEFAULT_OPTIONS = {
  touch_drag_pan: true,
  touch_tap_drag_zoom: true,

  mouse_drag_pan: true,
  mouse_wheel_zoom: true,
  mouse_double_click_zoom: true,
  touch_pinch_zoom: true,

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
  containerEl: HTMLElement;
  transformEl: HTMLElement;
  videoEl: HTMLVideoElement;
  resizeObserver: ResizeObserver;
  transform: Transform;
  options: Options;
  offHandles: Function[] = [];

  constructor(
    containerEl: HTMLElement,
    transformEl: HTMLElement,
    videoEl: HTMLVideoElement,
    options?: Options
  ) {
    this.containerEl = containerEl;
    this.transformEl = transformEl;
    this.videoEl = videoEl;
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.transform = new Transform({
      persist_key: this.options.persist_key,
      persist: this.options.persist,
    });

    const o = this.options;
    const gestureParam = {
      containerEl: this.containerEl,
      transform: this.transform,
      render: this.render,
    };
    const h = this.offHandles;
    if (o.mouse_drag_pan) h.push(startMouseDragPan(gestureParam));
    if (o.mouse_wheel_zoom) h.push(startMouseWheel(gestureParam));
    if (o.mouse_double_click_zoom) h.push(startDoubleClickZoom(gestureParam));
    if (o.touch_tap_drag_zoom) h.push(startTouchTapDragZoom(gestureParam));
    if (o.touch_drag_pan) h.push(startTouchDragPan(gestureParam));
    if (o.touch_pinch_zoom) h.push(startTouchPinchZoom(gestureParam));

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
    for (const off of this.offHandles) off();
    this.videoEl.removeEventListener("loadedmetadata", this.recomputeRects);
    this.resizeObserver.unobserve(this.containerEl);
  }

  private render = (transition = false) => {
    if (transition) {
      // transition is used to animate dbl click zoom
      this.transformEl.style.transition = "transform 200ms";
      setTimeout(() => {
        this.transformEl.style.transition = "";
      }, 200);
    }
    this.transformEl.style.transform = this.transform.render();
  };
}

/* Gestures */

const preventScroll = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
};

type GestureParam = {
  containerEl: HTMLElement;
  transform: Transform;
  render: (transition?: boolean) => void;
};

const getCenter = (touches: TouchList) => ({
  x: (touches[0].pageX + touches[1].pageX) / 2,
  y: (touches[0].pageY + touches[1].pageY) / 2,
});
const getSpread = (touches: TouchList) =>
  Math.hypot(
    touches[0].pageX - touches[1].pageX,
    touches[0].pageY - touches[1].pageY
  );

function startTouchPinchZoom({ containerEl, transform, render }: GestureParam) {
  const onTouchStart = (downEvent: TouchEvent) => {
    const relevant = downEvent.touches.length === 2;
    if (!relevant) return;

    let lastTouches = downEvent.touches;
    const onTouchMove = (moveEvent: TouchEvent) => {
      const newTouches = moveEvent.touches;
      const oldCenter = getCenter(lastTouches);
      const newCenter = getCenter(newTouches);
      const dx = newCenter.x - oldCenter.x;
      const dy = newCenter.y - oldCenter.y;
      transform.move(dx, dy);

      const oldSpread = getSpread(lastTouches);
      const newSpread = getSpread(newTouches);
      const zoom = newSpread / oldSpread;
      transform.zoomAtCoords(zoom, newCenter.x, newCenter.y);
      lastTouches = moveEvent.touches;
      render();
      preventScroll(moveEvent);
    };
    const onTouchEnd = () =>
      containerEl.removeEventListener("touchmove", onTouchMove);
    containerEl.addEventListener("touchmove", onTouchMove);
    containerEl.addEventListener("touchend", onTouchEnd, { once: true });
  };
  containerEl.addEventListener("touchstart", onTouchStart);
  return () => containerEl.removeEventListener("touchstart", onTouchStart);
}

const getDist = (t1: TouchEvent, t2: TouchEvent) =>
  Math.hypot(
    t1.touches[0].pageX - t2.touches[0].pageX,
    t1.touches[0].pageY - t2.touches[0].pageY
  );

function startTouchTapDragZoom({
  containerEl,
  transform,
  render,
}: GestureParam) {
  let lastEvent: TouchEvent;
  let fastClicks = 0;
  const onTouchStart = (downEvent: TouchEvent) => {
    const isFastClick =
      lastEvent && downEvent.timeStamp - lastEvent.timeStamp < DBL_CLICK_MS;
    if (!isFastClick) fastClicks = 0;
    fastClicks++;
    if (downEvent.touches.length > 1) fastClicks = 0;
    lastEvent = downEvent;
  };

  const onTouchMove = (moveEvent: TouchEvent) => {
    if (fastClicks === 2) {
      const lastY = lastEvent.touches[0].pageY;
      const currY = moveEvent.touches[0].pageY;
      transform.zoom(1 - (lastY - currY) * ONE_FINGER_ZOOM_SPEED);
      lastEvent = moveEvent;
      render();
      preventScroll(moveEvent);
    } else if (getDist(lastEvent, moveEvent) > 10) {
      fastClicks = 0;
    }
  };
  containerEl.addEventListener("touchmove", onTouchMove);
  containerEl.addEventListener("touchstart", onTouchStart);
  return () => {
    containerEl.removeEventListener("touchmove", onTouchMove);
    containerEl.removeEventListener("touchstart", onTouchStart);
  };
}

function startMouseWheel({ containerEl, transform, render }: GestureParam) {
  const onWheel = (e: WheelEvent) => {
    const zoom = 1 - e.deltaY / 1000;
    transform.zoomAtCoords(zoom, e.pageX, e.pageY);
    render();
    preventScroll(e);
  };
  containerEl.addEventListener("wheel", onWheel);
  return () => containerEl.removeEventListener("wheel", onWheel);
}

function startDoubleClickZoom({
  containerEl,
  transform,
  render,
}: GestureParam) {
  let lastDown = 0;
  let clicks = 0;
  const onDown = (downEvent: MouseEvent) => {
    const isFastClick = downEvent.timeStamp - lastDown < DBL_CLICK_MS;
    lastDown = downEvent.timeStamp;
    if (!isFastClick) clicks = 0;
    clicks++;
    if (clicks !== 2) return;
    const onUp = (upEvent: MouseEvent) => {
      const isQuickRelease = upEvent.timeStamp - lastDown < DBL_CLICK_MS;
      const dist = Math.hypot(
        upEvent.pageX - downEvent.pageX,
        upEvent.pageY - downEvent.pageY
      );
      if (!isQuickRelease || dist > 20) return;
      const zoom = transform.scale == 1 ? 2 : 0.01;
      transform.zoomAtCoords(zoom, upEvent.pageX, upEvent.pageY);
      render(true);
    };
    window.addEventListener("mouseup", onUp, { once: true });
  };
  containerEl.addEventListener("mousedown", onDown);
  return () => containerEl.removeEventListener("mousedown", onDown);
}

function startGesturePan(
  { containerEl, transform, render }: GestureParam,
  type: "mouse" | "touch"
) {
  const [downName, moveName, upName] =
    type === "mouse"
      ? (["mousedown", "mousemove", "mouseup"] as const)
      : (["touchstart", "touchmove", "touchend"] as const);

  const onDown = (downEvt: TouchEvent | MouseEvent) => {
    let last = downEvt instanceof TouchEvent ? downEvt.touches[0] : downEvt;

    const onMove = (moveEvt: TouchEvent | MouseEvent) => {
      if (moveEvt instanceof TouchEvent && moveEvt.touches.length !== 1) return;
      const curr = moveEvt instanceof TouchEvent ? moveEvt.touches[0] : moveEvt;
      transform.move(curr.pageX - last.pageX, curr.pageY - last.pageY);
      last = curr;
      render();
      if (transform.scale !== 1) preventScroll(moveEvt);
    };
    containerEl.addEventListener(moveName, onMove);
    const onUp = () => containerEl.removeEventListener(moveName, onMove);
    window.addEventListener(upName, onUp, { once: true });
  };
  containerEl.addEventListener(downName, onDown);
  return () => containerEl.removeEventListener(downName, onDown);
}

function startTouchDragPan(params: GestureParam) {
  return startGesturePan(params, "touch");
}

function startMouseDragPan(params: GestureParam) {
  return startGesturePan(params, "mouse");
}

/** Transform */

const PERSIST_KEY_PREFIX = "webrtc-digital-ptc:";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type Settings = { persist_key: string; persist: boolean };

function getTransformedDimensions(video: HTMLVideoElement) {
  const { videoWidth, videoHeight } = video;
  if (!videoHeight || !videoWidth) return undefined;
  var transform = window.getComputedStyle(video).getPropertyValue("transform");
  const match = transform.match(/matrix\((.+)\)/);
  if (!match || !match[1]) return { videoWidth, videoHeight }; // the video isn't transformed
  const matrix = new DOMMatrix(match[1].split(", ").map(Number));
  const points = [
    new DOMPoint(0, 0),
    new DOMPoint(videoWidth, 0),
    new DOMPoint(0, videoHeight),
    new DOMPoint(videoWidth, videoHeight),
  ].map((point) => point.matrixTransform(matrix));

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  return { videoWidth: maxX - minX, videoHeight: maxY - minY };
}

class Transform {
  scale = 1;
  x = 0;
  y = 0;
  videoRect?: DOMRect;
  containerRect?: DOMRect;
  settings: Settings;
  constructor(settings: Settings) {
    this.settings = {
      ...settings,
      persist_key: PERSIST_KEY_PREFIX + settings.persist_key,
    };
    this.loadPersistedTransform();
  }
  public updateRects(videoEl: HTMLVideoElement, containerEl: HTMLElement) {
    const containerRect = containerEl.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      // The container rect has no size yet.
      // This happens when coming back to a tab that was already opened.
      // The card will get size shortly and the size observer will call this function again.
      return;
    }
    this.containerRect = containerRect;
    const transformed = getTransformedDimensions(videoEl);
    if (!transformed) {
      // The video hasn't loaded yet.
      // Once it loads, the videometadata listener will call this function again.
      return;
    }

    // When in full screen, and if the aspect ratio of the screen differs from that of the video,
    // black bars will be shown either to the sides or above/below the video.
    // This needs to be accounted for when panning, the code below keeps track of that.
    const screenAspectRatio =
      this.containerRect.width / this.containerRect.height;
    const videoAspectRatio = transformed.videoWidth / transformed.videoHeight;

    if (videoAspectRatio > screenAspectRatio) {
      // Black bars on the top and bottom
      const videoHeight = this.containerRect.width / videoAspectRatio;
      const blackBarHeight = (this.containerRect.height - videoHeight) / 2;
      this.videoRect = new DOMRect(
        this.containerRect.x,
        blackBarHeight + this.containerRect.y,
        this.containerRect.width,
        videoHeight
      );
    } else {
      // Black bars on the sides
      const videoWidth = this.containerRect.height * videoAspectRatio;
      const blackBarWidth = (this.containerRect.width - videoWidth) / 2;
      this.videoRect = new DOMRect(
        blackBarWidth + this.containerRect.x,
        this.containerRect.y,
        videoWidth,
        this.containerRect.height
      );
    }
  }

  // dx,dy are deltas.
  public move(dx: number, dy: number) {
    if (!this.videoRect) return;
    const bound = (this.scale - 1) / 2;
    this.x += dx / this.videoRect.width;
    this.y += dy / this.videoRect.height;
    this.x = clamp(this.x, -bound, bound);
    this.y = clamp(this.y, -bound, bound);
    this.persistTransform();
  }

  // x,y are relative to viewport (clientX, clientY)
  public zoomAtCoords(zoom: number, x: number, y: number) {
    if (!this.containerRect || !this.videoRect) return;
    const oldScale = this.scale;
    this.scale *= zoom;
    this.scale = clamp(this.scale, 1, MAX_ZOOM);
    zoom = this.scale / oldScale;

    x = x - this.containerRect.x - this.containerRect.width / 2;
    y = y - this.containerRect.y - this.containerRect.height / 2;
    const dx = x - this.x * this.videoRect.width;
    const dy = y - this.y * this.videoRect.height;
    this.move(dx * (1 - zoom), dy * (1 - zoom));
  }

  public zoom(zoom: number) {
    if (!this.containerRect || !this.videoRect) return;
    const x = this.containerRect.width / 2;
    const y = this.containerRect.height / 2;
    this.zoomAtCoords(zoom, x, y);
  }

  public render() {
    if (!this.videoRect) return "";
    const { x, y, scale } = this;
    return `translate(${x * this.videoRect.width}px, ${
      y * this.videoRect.height
    }px) scale(${scale})`;
  }

  loadPersistedTransform = () => {
    const { persist_key, persist } = this.settings;
    if (!persist) return;
    try {
      const loaded = JSON.parse(localStorage[persist_key]);
      const isValid = [loaded.scale, loaded.x, loaded.y].every(Number.isFinite);
      if (!isValid) {
        throw new Error("Broken local storage");
      }
      this.x = loaded.x;
      this.y = loaded.y;
      this.scale = loaded.scale;
    } catch (e) {
      delete localStorage[persist_key];
    }
  };

  persistTransform = () => {
    const { persist_key, persist } = this.settings;
    if (!persist) return;
    const { x, y, scale } = this;
    localStorage[persist_key] = JSON.stringify({
      x,
      y,
      scale,
    });
  };
}
