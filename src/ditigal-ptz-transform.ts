// js version generated from https://github.com/dbuezas/pan-zoom-controller/blob/main/src/digital-ptz.ts

import { MAX_ZOOM } from "./digital-ptz";

const PERSIST_KEY_PREFIX = "webrtc-digital-ptc:";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
type Settings = { persist_key: string; persist: boolean };
export class Transform {
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
    this.containerRect = containerEl.getBoundingClientRect();
    if (!videoEl.videoWidth) {
      console.log("this.videoEl.videoWidth video not loaded");
      return;
    }

    const screenAspectRatio =
      this.containerRect.width / this.containerRect.height;
    const videoAspectRatio = videoEl.videoWidth / videoEl.videoHeight;

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
      const isValid = [loaded.scale || loaded.x || loaded.y].every(
        Number.isFinite
      );
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
