import { modifier } from 'ember-modifier';
import { DragGesture } from '@use-gesture/vanilla';
import type {
  DragGesture as VanillaDragGesture,
  DragState,
} from '@use-gesture/vanilla';
import {
  normalizeOverscrollTolerance,
  shouldTriggerOverscroll,
} from 'potber-client/utils/gestures';
import { debounce } from 'potber-client/utils/misc';

function resolveScrollContainer(
  scrollContainer?: HTMLElement | string,
): HTMLElement {
  if (!scrollContainer) {
    return (document.scrollingElement ??
      document.documentElement) as HTMLElement;
  }

  if (typeof scrollContainer === 'string') {
    const element = document.getElementById(scrollContainer);

    if (!element) {
      throw new Error(`Could not find scroll container "${scrollContainer}"`);
    }

    return element;
  }

  return scrollContainer;
}

interface OverscrollGestureSignature {
  Element: HTMLElement;
  Args: {
    Named: {
      direction: 'up' | 'down';
      onOverscroll: () => void;
      scrollContainer?: HTMLElement | string;
      disabled?: boolean;
      delay?: number;
      tolerance?: number;
      minimumPullDistance: number;
    };
    Positional: [];
  };
}

export default modifier<OverscrollGestureSignature>(
  (element, _positional, named) => {
    if (named.disabled) {
      return;
    }

    let gestureStartedAtOverscrollEdge = false;
    let indicatorVisible = false;

    const getIndicator = () =>
      element.querySelector<HTMLElement>('[data-overscroll-indicator]');

    const hideIndicator = () => {
      const indicator = getIndicator();

      if (indicator) {
        indicator.style.height = '0px';
        indicator.dataset['overscrollReady'] = 'false';
      }

      indicatorVisible = false;
    };

    const hideIndicatorDebounced = debounce(hideIndicator, named.delay ?? 1000);

    const showIndicator = () => {
      const indicator = getIndicator();

      if (!indicator) {
        return;
      }

      indicator.style.height = 'var(--control-default-height)';
      indicator.dataset['overscrollReady'] = 'true';
      indicatorVisible = true;
      void hideIndicatorDebounced();
    };

    const updateIndicator = (pullDistance: number, isReady: boolean) => {
      const indicator = getIndicator();

      if (!indicator) {
        return;
      }

      const nextHeight = Math.min(
        Math.max(pullDistance, 0),
        named.minimumPullDistance,
      );

      indicator.style.height = `${nextHeight}px`;
      indicator.dataset['overscrollReady'] = String(isReady);
      indicatorVisible = nextHeight > 0;
    };

    const handleDrag = (state: DragState) => {
      const scrollContainer = resolveScrollContainer(named.scrollContainer);

      const [deltaX, deltaY] = state.movement;

      const direction = deltaY > 0 ? 'down' : 'up';

      const isVerticalGesture = Math.abs(deltaY) > Math.abs(deltaX);
      const pullDistance = Math.abs(deltaY);
      const isMatchingDirection = direction === named.direction;
      const meetsMinimumPullDistance =
        pullDistance >= named.minimumPullDistance;

      if (state.first) {
        const { scrollTop, clientHeight, scrollHeight } = scrollContainer;

        gestureStartedAtOverscrollEdge = shouldTriggerOverscroll({
          direction: named.direction,
          scrollTop,
          clientHeight,
          scrollHeight,
          tolerance: normalizeOverscrollTolerance(named.tolerance),
        });
      }

      if (!gestureStartedAtOverscrollEdge) {
        if (indicatorVisible) {
          hideIndicator();
        }

        return;
      }

      if (!state.last) {
        if (isVerticalGesture && isMatchingDirection) {
          updateIndicator(pullDistance, meetsMinimumPullDistance);
        } else if (indicatorVisible) {
          hideIndicator();
        }

        return;
      }

      if (!meetsMinimumPullDistance || !isVerticalGesture) {
        hideIndicator();
        return;
      }

      if (direction !== named.direction) {
        hideIndicator();
        return;
      }

      showIndicator();
      named.onOverscroll();
    };

    const gesture: VanillaDragGesture = new DragGesture(element, handleDrag, {
      filterTaps: false,
      triggerAllEvents: true,
      pointer: {
        touch: true,
        capture: false,
      },
    });

    return () => {
      gesture.destroy();
    };
  },
);
