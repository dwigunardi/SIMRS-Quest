/**
 * Pustaka Materi: satu artikel per konsep, ditautkan ke misi yang memakainya.
 * Urutan di sini = urutan tampil di daftar "Semua materi".
 */
import type { Article, Mission } from '../../types';
import { ARTICLES_TIER1 } from './tier1';
import { ARTICLES_TIER2 } from './tier2';
import { ARTICLES_TIER3 } from './tier3';
import { ARTICLES_TIER4 } from './tier4';
import { ARTICLES_TIER5 } from './tier5';
import { ARTICLES_TIER6 } from './tier6';
import { ARTICLES_TIER7 } from './tier7';
import { ARTICLES_TIER8 } from './tier8';
import { ARTICLES_TIER9 } from './tier9';
import { ARTICLES_TIER10 } from './tier10';
import { ARTICLES_UMUM } from './umum';

export const ARTICLES: Article[] = [
  ...ARTICLES_UMUM,
  ...ARTICLES_TIER1,
  ...ARTICLES_TIER2,
  ...ARTICLES_TIER3,
  ...ARTICLES_TIER4,
  ...ARTICLES_TIER5,
  ...ARTICLES_TIER6,
  ...ARTICLES_TIER7,
  ...ARTICLES_TIER8,
  ...ARTICLES_TIER9,
  ...ARTICLES_TIER10,
];

export function getArticleById(id: string): Article | undefined {
  return ARTICLES.find((article) => article.id === id);
}

/** Artikel yang terkait dengan misi; artikel yang MEMPERKENALKAN konsepnya di misi ini didahulukan. */
export function articlesForMission(mission: Pick<Mission, 'id'>): Article[] {
  const linked = ARTICLES.filter((article) => article.missions.includes(mission.id));
  return [...linked].sort((a, b) => Number(b.missions[0] === mission.id) - Number(a.missions[0] === mission.id));
}
