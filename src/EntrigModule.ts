import { NativeModules, NativeEventEmitter } from 'react-native';

import { EntrigConfig, NotificationEvent } from './types';

const RNEntrigModule = NativeModules.Entrig;

if (!RNEntrigModule) {
  throw new Error('Native Entrig module not found. Make sure you have linked the library correctly.');
}

// Create event emitter for native events
const eventEmitter = new NativeEventEmitter(RNEntrigModule);

// Export the native module with proper type annotations
class EntrigModuleClass {
  async init(config: EntrigConfig): Promise<void> {
    return RNEntrigModule.initialize(config);
  }

  async register(userId: string, isDebug?: boolean): Promise<void> {
    return RNEntrigModule.register(userId, isDebug ?? null);
  }

  async requestPermission(): Promise<boolean> {
    return RNEntrigModule.requestPermission();
  }

  async unregister(): Promise<void> {
    return RNEntrigModule.unregister();
  }

  async getInitialNotification(): Promise<NotificationEvent | null> {
    return RNEntrigModule.getInitialNotification();
  }

  // Event listener methods
  onForegroundNotification(callback: (event: NotificationEvent) => void) {
    const subscription = eventEmitter.addListener('onForegroundNotification', callback);
    return subscription;
  }

  onNotificationOpened(callback: (event: NotificationEvent) => void) {
    const subscription = eventEmitter.addListener('onNotificationOpened', callback);
    return subscription;
  }
}

export default new EntrigModuleClass();
