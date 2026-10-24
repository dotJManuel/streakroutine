import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_ACTIVE_DAYS,
  DEFAULT_FREEZE_MIN,
  DEFAULT_GOAL,
  DEFAULT_HABITS,
} from './shared/habits.config';
import type { Days } from './shared/streaks';
import type { Habits } from './shared/types';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface HabitItem {
  k: string;
  name: string;
  when: string;
  active: boolean;
}

export interface Loaded {
  days: Days;
  habits: HabitItem[];
  goal: number;
  freezeMin: number;
  activeDays: number[];
}

/** Días, ajustes y misiones del usuario con sesión. Si aún no tiene ajustes, usa los valores iniciales. */
export async function loadAll(): Promise<Loaded> {
  const [d, s, h] = await Promise.all([
    supabase.from('days').select('date, habits'),
    supabase.from('settings').select('goal, freeze_min, active_days').maybeSingle(),
    supabase.from('habits').select('key, name, when_text, active').order('position'),
  ]);
  if (d.error) throw d.error;
  if (s.error) throw s.error;
  if (h.error) throw h.error;

  const days: Days = Object.fromEntries((d.data ?? []).map((r) => [r.date as string, r.habits as Habits]));

  if (!s.data) {
    return {
      days,
      habits: DEFAULT_HABITS.map((x) => ({ ...x, active: true })),
      goal: DEFAULT_GOAL,
      freezeMin: DEFAULT_FREEZE_MIN,
      activeDays: DEFAULT_ACTIVE_DAYS,
    };
  }
  return {
    days,
    habits: (h.data ?? []).map((r) => ({
      k: r.key as string,
      name: r.name as string,
      when: r.when_text as string,
      active: r.active as boolean,
    })),
    goal: s.data.goal,
    freezeMin: s.data.freeze_min,
    activeDays: s.data.active_days,
  };
}

/** Guarda (inserta o actualiza) un día. user_id lo pone la base de datos. */
export async function saveDay(date: string, habits: Habits): Promise<void> {
  const { error } = await supabase
    .from('days')
    .upsert({ date, habits, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
  if (error) throw error;
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Devuelve un mensaje de error en español, o null si entró bien. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return null;
  const m = error.message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar.';
  return 'No se pudo iniciar sesión. Intenta de nuevo.';
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
