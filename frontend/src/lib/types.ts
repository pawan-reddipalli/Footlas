export type Mode = "map" | "player";

export type Question = {
  id: number;
  mode: Mode;
  kind: string;
  prompt: string;
  difficulty: number;
  subject?: string;
  clues?: string[];
  options?: { id: string; label: string }[];
};

export type LearnCard = { title: string; body: string; facts: string[] };

export type RevealedAnswer = {
  map_id?: string;
  country?: string;
  flag?: string;
  option_id?: string;
  label?: string;
};

export type Progress = {
  xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next: number;
  streak: number;
  longest_streak: number;
};

export type UnlockedAchievement = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
};

/** One-off XP on top of an answer: a streak milestone, a perfect daily, a completed country. */
export type Bonus = {
  kind: "daily_complete" | "daily_perfect" | "streak_milestone" | "country_complete" | (string & {});
  label: string;
  xp: number;
};

export type AnswerResult = {
  correct: boolean;
  answer: RevealedAnswer;
  learn: LearnCard;
  xp_awarded: number;
  given?: string;
  progress?: Progress;
  unlocked?: UnlockedAchievement[];
  bonuses?: Bonus[];
  bonus_xp?: number;
};

export type DailySummary = {
  answered: number;
  correct: number;
  total: number;
  complete: boolean;
  perfect: boolean;
  bonus_xp?: number;
};

export type DailyState = {
  day: string;
  items: { question: Question; result: AnswerResult | null }[];
  summary: DailySummary;
  progress: Progress;
};

export type DailyAnswerResult = AnswerResult & { summary: DailySummary };

export type Achievement = UnlockedAchievement & {
  threshold: number;
  progress: number;
  unlocked_at: string | null;
};

export type Profile = {
  username: string;
  avatar_url: string | null;
  plan: string;
  entitlements: string[];
  joined_at: string;
  progress: Progress;
  stats: {
    answered: number;
    correct: number;
    accuracy: number | null;
    by_mode: Partial<Record<Mode, { answered: number; correct: number }>>;
    daily_completed: number;
  };
  achievements: Achievement[];
};
