export type NotificationEvent = {
  title: string;
  body: string;
  type?: string | null;
  deeplink?: string | null;
  data: Record<string, any>;
};

export type EntrigConfig = {
  apiKey: string;
  handlePermission?: boolean;
  showForegroundNotification?: boolean;
  autoOpenDeeplink?: boolean;
};

export type EntrigModuleEvents = {
  onForegroundNotification: (event: NotificationEvent) => void;
  onNotificationOpened: (event: NotificationEvent) => void;
};
