import {
  notifyCRRoomAllocated,
  notifyCRRoomRequestSubmitted,
  notifyCRRoomRejected,
  notifyTeacherRoomApproved,
  notifyTeacherRoomRejected,
  notifyAdminRoomRequestPending,
  notifyAnnouncement,
} from './notifications';

// ── DB Notification Subscriber ────────────────────────────────────────────────
export async function dbSubscriber(event: { type: string; payload: any }) {
  let notificationId: string | null = null;

  switch (event.type) {
    case 'cr_room_request.allocated':
      notificationId = await notifyCRRoomAllocated(event.payload);
      break;
    case 'cr_room_request.submitted':
      notificationId = await notifyCRRoomRequestSubmitted(event.payload);
      break;
    case 'cr_room_request.rejected':
      notificationId = await notifyCRRoomRejected(event.payload);
      break;
    case 'teacher_room_request.submitted':
      notificationId = await notifyAdminRoomRequestPending(event.payload);
      break;
    case 'teacher_room_request.approved':
      notificationId = await notifyTeacherRoomApproved(event.payload);
      break;
    case 'teacher_room_request.rejected':
      notificationId = await notifyTeacherRoomRejected(event.payload);
      break;
    case 'announcement.created':
      notificationId = await notifyAnnouncement(event.payload);
      break;
    default:
      return;
  }

  if (notificationId) {
    // Dynamically import to avoid static circular dependency
    const { notificationBroker } = await import('./notificationBroker');
    await notificationBroker.publish('notification.created', {
      id: notificationId,
      ...event.payload,
    });
  }
}

// ── Push Outbox Subscriber ────────────────────────────────────────────────────
export async function pushOutboxSubscriber(event: { type: string; payload: any }) {
  if (event.type !== 'notification.created') return;

  const { id } = event.payload;
  if (!id) return;

  const { getSupabaseAdmin } = await import('./supabaseAdmin');
  const db = getSupabaseAdmin();

  try {
    await db
      .from('notification_push_outbox')
      .upsert({ notification_id: id, status: 'pending' }, { onConflict: 'notification_id', ignoreDuplicates: true });

    const { dispatchPendingPushNotifications } = await import('./pushDispatch');
    await dispatchPendingPushNotifications(10);
  } catch (error) {
    console.error('[PushOutboxSubscriber] Failed to enqueue and dispatch push:', error);
  }
}

// ── SoC Audit Logger ──────────────────────────────────────────────────────────
export function auditLoggerSubscriber(event: { type: string; payload: any }) {
  const auditLog = {
    event: event.type,
    timestamp: new Date().toISOString(),
    payload: event.payload,
  };
  console.log(`[SoC Audit Log] ${JSON.stringify(auditLog)}`);
}
