import type { TransitionName } from "./types";

const classNames: Record<TransitionName, string> = {
  cut: "transition-cut",
  fade: "transition-fade",
  crossfade: "transition-crossfade",
  slide: "transition-slide",
};

export function applyTransition(element: HTMLElement, transition: TransitionName): void {
  element.classList.remove(...Object.values(classNames));
  element.classList.add(classNames[transition]);
}
