import { MN } from './habits.config';
import type { Habits } from './types';

/** "YYYY-MM-DD" -> misiones marcadas ese día */
export type Days = Record<string, Habits>;

export interface RachaConfig {
  /** Todas las misiones que existen (activas o no): las marcas pasadas siguen contando. */
  habitKeys: string[];
  goal: number;
  freezeMin: number;
  /** Días obligatorios, 0 = domingo ... 6 = sábado. */
  activeDays: number[];
}

export interface StreakInfo {
  cur: number;
  best: number;
  /** Días obligatorios que no se cumplieron pero fueron congelados. */
  frozen: Set<string>;
  /** El último día se congeló y falta cumplir para recuperar la racha. */
  recovering: boolean;
  /** Hay una congelación ganada por si un día no se cumple. */
  freezeReady: boolean;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Un día de descanso no rompe la racha. */
export function isRestDay(d: Date, activeDays: number[]): boolean {
  return !activeDays.includes(d.getDay());
}

/** "08:15" si se marcó el mismo día; "22 oct 23:40" si se marcó otro día. Vacío si no hay hora. */
export function doneAtLabel(value: boolean | string | undefined, dayKey: string): string {
  if (typeof value !== 'string') return '';
  const t = new Date(value);
  if (isNaN(t.getTime())) return '';
  const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  return dateKey(t) === dayKey ? hm : `${t.getDate()} ${MN[t.getMonth()]} ${hm}`;
}

export function countDone(days: Days, k: string, habitKeys: string[]): number {
  const h = days[k] ?? {};
  return habitKeys.filter((x) => h[x]).length;
}

/**
 * Recorre los días en orden. Los días de descanso no rompen la racha, y hoy aún no cuenta como
 * fallado. Un día obligatorio sin cumplir se congela si hubo al menos freezeMin días cumplidos
 * desde el último quiebre o congelación; si no, la racha se rompe.
 */
export function computeStreaks(days: Days, today: Date, cfg: RachaConfig): StreakInfo {
  const done = (k: string) => countDone(days, k, cfg.habitKeys);
  const frozen = new Set<string>();
  let run = 0;
  let best = 0;
  let sinceFreeze = 0;
  let recovering = false;

  const keys = Object.keys(days)
    .filter((k) => done(k) > 0)
    .sort();
  if (keys.length) {
    const todayKey = dateKey(today);
    let d = parseKey(keys[0]);
    while (d <= today) {
      const k = dateKey(d);
      if (done(k) >= cfg.goal) {
        run++;
        sinceFreeze++;
        recovering = false;
        best = Math.max(best, run);
      } else if (!isRestDay(d, cfg.activeDays) && k !== todayKey) {
        if (sinceFreeze >= cfg.freezeMin) {
          frozen.add(k);
          sinceFreeze = 0;
          recovering = true;
        } else {
          run = 0;
          sinceFreeze = 0;
          recovering = false;
        }
      }
      d = addDays(d, 1);
    }
  }
  return { cur: run, best, frozen, recovering, freezeReady: !recovering && sinceFreeze >= cfg.freezeMin };
}
