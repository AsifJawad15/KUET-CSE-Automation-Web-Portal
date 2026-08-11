import { dbSubscriber, pushOutboxSubscriber, auditLoggerSubscriber } from './notificationSubscribers';

type NotificationEvent = {
  type: string;
  payload: any;
};

type Subscriber = (event: NotificationEvent) => Promise<void> | void;

class NotificationBroker {
  private subscribers: Map<string, Subscriber[]> = new Map();

  constructor() {
    // Register default subscribers
    this.subscribe('cr_room_request.allocated', dbSubscriber);
    this.subscribe('cr_room_request.submitted', dbSubscriber);
    this.subscribe('cr_room_request.rejected', dbSubscriber);
    this.subscribe('teacher_room_request.submitted', dbSubscriber);
    this.subscribe('teacher_room_request.approved', dbSubscriber);
    this.subscribe('teacher_room_request.rejected', dbSubscriber);
    this.subscribe('announcement.created', dbSubscriber);

    this.subscribe('notification.created', pushOutboxSubscriber);

    this.subscribe('*', auditLoggerSubscriber);
  }

  subscribe(eventType: string, subscriber: Subscriber) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(subscriber);
  }

  async publish(eventType: string, payload: any) {
    const eventSubscribers = this.subscribers.get(eventType) || [];
    const wildcardSubscribers = this.subscribers.get('*') || [];
    const targets = [...new Set([...eventSubscribers, ...wildcardSubscribers])];

    await Promise.allSettled(
      targets.map(async (subscriber) => {
        try {
          await subscriber({ type: eventType, payload });
        } catch (error) {
          console.error(`[NotificationBroker] Error in subscriber for event ${eventType}:`, error);
        }
      })
    );
  }
}

export const notificationBroker = new NotificationBroker();
