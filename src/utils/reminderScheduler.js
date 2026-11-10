import Reminder from "../models/Reminder.js";
import DeviceToken from "../models/DeviceToken.js";

let isRunning = false;

async function sendPushNotifications(tokens, reminder) {
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: reminder.title,
    body: reminder.body,
    data: {
      reminderId: reminder._id.toString(),
      type: reminder.type,
    },
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo Push API returned ${response.status}`);
  }

  const result = await response.json();

  return result.data?.some((ticket) => ticket.status === "ok") ?? false;
}

function getNextRunDate(reminder) {
  if (reminder.repeat === "none") return null;

  const next = new Date(reminder.nextRunAt);
  const interval = reminder.repeat === "daily" ? 1 : 7;

  // Advance past any missed occurrences.
  do {
    next.setDate(next.getDate() + interval);
  } while (next <= new Date());

  return next;
}

export async function processDueReminders() {
  if (isRunning) return;

  isRunning = true;

  try {
    const dueReminders = await Reminder.find({
      enabled: true,
      nextRunAt: { $lte: new Date() },
    }).limit(100);

    for (const reminder of dueReminders) {
      try {
        const devices = await DeviceToken.find({ user: reminder.user });

        // Keep the reminder pending until the user registers a device.
        if (devices.length === 0) continue;

        const tokens = devices.map((device) => device.expoPushToken);
        const sent = await sendPushNotifications(tokens, reminder);

        if (!sent) continue;

        const nextRunAt = getNextRunDate(reminder);

        await Reminder.updateOne(
          { _id: reminder._id, nextRunAt: reminder.nextRunAt },
          {
            $set: {
              lastSentAt: new Date(),
              ...(nextRunAt
                ? { nextRunAt }
                : { enabled: false }),
            },
          }
        );
      } catch (error) {
        console.error(
          `Reminder ${reminder._id} could not be sent:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error("Reminder scheduler error:", error.message);
  } finally {
    isRunning = false;
  }
}

export function startReminderScheduler() {
  // Check once when the server starts, then every minute.
  processDueReminders();

  setInterval(processDueReminders, 60 * 1000);

  console.log("Reminder scheduler started.");
}
