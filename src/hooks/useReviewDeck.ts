/**
 * Jadwal latihan ulang (deck Leitner) di localStorage, disinkronkan antar-tab lewat event `storage`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MISSIONS } from '../data/missions';
import type { ExamItemStatus } from '../lib/exam';
import { toLocalDateKey } from '../lib/progress';
import { REVIEW_KEY, parseDeck, updateDeck, type ReviewDeck } from '../lib/review';
import type { UserProgress } from '../types';

function readDeck(): ReviewDeck {
  try {
    const raw = window.localStorage.getItem(REVIEW_KEY);
    return raw === null ? {} : parseDeck(JSON.parse(raw));
  } catch {
    return {};
  }
}

function saveDeck(deck: ReviewDeck): void {
  try {
    window.localStorage.setItem(REVIEW_KEY, JSON.stringify(deck));
  } catch {
    /* penyimpanan penuh / tidak tersedia */
  }
}

export interface ReviewDeckApi {
  deck: ReviewDeck;
  /** Perbarui jadwal dari hasil sesi (latihan ulang atau ujian). */
  apply: (progress: UserProgress, items: ReadonlyArray<{ missionId: string; status: ExamItemStatus }>) => void;
  reset: () => void;
}

export function useReviewDeck(): ReviewDeckApi {
  const [deck, setDeck] = useState<ReviewDeck>(readDeck);
  const deckRef = useRef(deck);
  deckRef.current = deck;

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REVIEW_KEY || event.key === null) setDeck(readDeck());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const apply = useCallback((progress: UserProgress, items: ReadonlyArray<{ missionId: string; status: ExamItemStatus }>) => {
    const next = updateDeck(deckRef.current, MISSIONS, progress, items, toLocalDateKey(new Date()));
    deckRef.current = next;
    saveDeck(next);
    setDeck(next);
  }, []);

  const reset = useCallback(() => {
    deckRef.current = {};
    saveDeck({});
    setDeck({});
  }, []);

  return { deck, apply, reset };
}
