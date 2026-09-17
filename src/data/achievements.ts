import {
  Atom,
  Award,
  Flame,
  FolderKanban,
  GraduationCap,
  Link2,
  Rocket,
  Target,
  Waves,
} from 'lucide-react';
import { LESSONS } from './lessons';
import type { Achievement, AchievementStats } from './types';

/**
 * Achievements are pure predicates over aggregated progress, so they can be re-evaluated on
 * every state change.
 *
 * Each description states exactly what its predicate tests. Where an achievement names a
 * specific module the predicate checks that module, and "the whole curriculum" is derived
 * from LESSONS.length, so adding a sixth module cannot silently make the last achievement
 * mean something else.
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Open your first module.',
    icon: Rocket,
    xpBonus: 10,
    isUnlocked: stats => stats.lessonsStarted >= 1,
  },
  {
    id: 'superposition-master',
    name: 'Superposition Master',
    description: 'Finish the Superposition module.',
    icon: Waves,
    xpBonus: 25,
    isUnlocked: stats => stats.completedLessons.includes('superposition'),
  },
  {
    id: 'entangler',
    name: 'Entangler',
    description: 'Build a circuit whose qubits are entangled.',
    icon: Link2,
    xpBonus: 30,
    isUnlocked: stats => stats.entanglementsBuilt,
  },
  {
    id: 'simulator-runner',
    name: 'Simulator Runner',
    description: 'Run five simulations.',
    icon: Atom,
    xpBonus: 20,
    isUnlocked: stats => stats.simulations >= 5,
  },
  {
    id: 'quiz-ace',
    name: 'Quiz Ace',
    description: 'Answer eight quiz questions correctly.',
    icon: Target,
    xpBonus: 30,
    isUnlocked: stats => stats.quizzesCorrect >= 8,
  },
  {
    id: 'challenger',
    name: 'Challenger',
    description: 'Pass three practice challenges.',
    icon: Award,
    xpBonus: 40,
    isUnlocked: stats => stats.challengesPassed >= 3,
  },
  {
    id: 'project-builder',
    name: 'Project Builder',
    description: 'Save three circuits to your project list.',
    icon: FolderKanban,
    xpBonus: 25,
    isUnlocked: stats => stats.projectsCreated >= 3,
  },
  {
    id: 'on-a-streak',
    name: 'On a Streak',
    description: 'Practise on three different days.',
    icon: Flame,
    xpBonus: 35,
    isUnlocked: stats => stats.streak >= 3,
  },
  {
    id: 'curriculum-complete',
    name: 'Quantum Graduate',
    description: 'Finish every module in the curriculum.',
    icon: GraduationCap,
    xpBonus: 100,
    isUnlocked: stats => stats.completedLessons.length >= LESSONS.length,
  },
];

export const ACHIEVEMENT_MAP: Record<string, Achievement> = ACHIEVEMENTS.reduce(
  (acc, achievement) => ({ ...acc, [achievement.id]: achievement }),
  {} as Record<string, Achievement>,
);

export function evaluateAchievements(stats: AchievementStats): string[] {
  return ACHIEVEMENTS.filter(achievement => achievement.isUnlocked(stats)).map(a => a.id);
}

/** Learner level derived from XP — 100 XP per level, growing slightly with each level. */
export function levelForXp(xp: number): { level: number; label: string; intoLevel: number; needed: number } {
  let level = 1;
  let remaining = xp;
  let needed = 100;
  while (remaining >= needed && level < 99) {
    remaining -= needed;
    level += 1;
    needed = 100 + (level - 1) * 25;
  }
  const labels = ['Observer', 'Tinkerer', 'Circuit Builder', 'Gate Wrangler', 'Entangler', 'Algorithmist', 'Quantum Engineer'];
  return {
    level,
    label: labels[Math.min(labels.length - 1, Math.floor((level - 1) / 1.5))],
    intoLevel: remaining,
    needed,
  };
}
