import type { ReadingStats } from "@attune/types";
import { findUserById } from "../repository/userRepository";
import { getReadingStatsData } from "../repository/interactionRepository";

export async function getUserReadingStats(userId: string): Promise<ReadingStats> {
  const [me, data] = await Promise.all([
    findUserById(userId),
    getReadingStatsData(userId),
  ]);

  const { dayList, minutesWeek, viewsWeek, savesTotal, totalPlatformMinutes, topTopics } = data;

  let streak = 0;
  if (dayList.length > 0) {
    const todayLocal = new Intl.DateTimeFormat("en-CA", {
      timeZone: me?.timezone ?? "Asia/Kolkata",
    }).format(new Date());

    const daySet = new Set(dayList);
    const shiftDay = (isoDate: string, deltaDays: number) =>
      new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + deltaDays * 86_400_000)
        .toISOString()
        .slice(0, 10);

    let cursor = todayLocal;
    if (!daySet.has(cursor)) cursor = shiftDay(cursor, -1);
    while (daySet.has(cursor)) {
      streak += 1;
      cursor = shiftDay(cursor, -1);
    }
  }

  return {
    streakDays: streak,
    minutesReadWeek: minutesWeek,
    itemsViewedWeek: viewsWeek,
    itemsSavedTotal: savesTotal,
    totalPlatformMinutes,
    topTopicsWeek: topTopics,
  };
}
