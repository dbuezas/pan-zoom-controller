import "./styles.css";
import { DigitalPTZ } from "./digital-ptz";

new DigitalPTZ(
  document.querySelector(".player")!,
  document.querySelector(".player .video-transform")!,
  document.querySelector(".player .video-transform video")!,
  {
    mouse_drag_pan: true,
    mouse_wheel_zoom: true,
    mouse_double_click_zoom: true,
    touch_tap_drag_zoom: true,
    touch_drag_pan: true,
    touch_pinch_zoom: true,
    touch_double_tap_zoom: true,
    persist: true,
    persist_key: "",
  }
);
