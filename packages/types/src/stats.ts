export interface DailyTrendPoint {
  date: string;
  count: number;
}

export interface TypeCountPoint {
  type: string;
  count: number;
}

export interface ReadingStats {
  streakDays: number;
  minutesReadWeek: number;
  itemsViewedWeek: number;
  itemsSavedTotal: number;
  totalPlatformMinutes?: number;
  topTopicsWeek: { key: string; interactions: number }[];
}

export interface AdminDashboardStats {
  usersTotal: number;
  usersNewToday: number;
  itemsTotal: number;
  itemsToday: number;
  interactionsToday: number;
  notifSentToday: number;
  usersTrend: DailyTrendPoint[];
  itemsTrend: DailyTrendPoint[];
  interactionsTrend: DailyTrendPoint[];
  notifTrend: DailyTrendPoint[];
  interactionsByType: TypeCountPoint[];
  itemsBySourceType: TypeCountPoint[];
  failingSources: {
    id: string;
    name: string;
    error: string;
    at: string;
  }[];
  topTopics: {
    key: string;
    name: string;
    icon: string | null;
    n: number;
  }[];
}
