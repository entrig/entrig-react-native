export type NotificationEvent = {
  title: string;
  body: string;
  data: Record<string, any>;
  isForeground: boolean;
};

export type EntrigConfig = {
  apiKey: string;
  handlePermission?: boolean;
  showForegroundNotification?: boolean;
};

export type EntrigModuleEvents = {
  onForegroundNotification: (event: NotificationEvent) => void;
  onNotificationOpened: (event: NotificationEvent) => void;
};
