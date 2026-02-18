import { useEffect, useRef } from 'react';

import EntrigModule from './EntrigModule';
import type { NotificationEvent } from './types';
export { default } from './EntrigModule';
export * from './types';

/**
 * Hook to listen for Entrig notification events.
 * The callback is stored in a ref so consumers don't need to memoize it —
 * the listener subscribes once and stays stable across re-renders.
 *
 * @param eventType - 'foreground' or 'opened'
 * @param callback - Function to call when event fires
 */
export function useEntrigEvent(
  eventType: 'foreground' | 'opened',
  callback: (event: NotificationEvent) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = (event: NotificationEvent) => callbackRef.current(event);

    const subscription =
      eventType === 'foreground'
        ? EntrigModule.onForegroundNotification(handler)
        : EntrigModule.onNotificationOpened(handler);

    return () => {
      subscription.remove();
    };
  }, [eventType]);
}
