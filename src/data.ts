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

async function read() {
  const [d, s, h] = await Promise.all([
    supabase.from('days').select('date, habits'),
    supabase.from('settings').select('goal, freeze_min, active_days').maybeSingle(),
    supabase.from('habits').select('key, name, when_text, active').order('position'),
  ]);
  if (d.error) throw d.error;
  if (s.error) throw s.error;
  if (h.error) throw h.error;
  return { days: d.data ?? [], settings: s.data, habits: h.data ?? [] };
}

/** Primera vez del usuario: copia los valores iniciales a la base de datos (igual que la app web). */
async function seed(): Promise<void> {
  const s = await supabase
    .from('settings')
    .upsert(
      { goal: DEFAULT_GOAL, freeze_min: DEFAULT_FREEZE_MIN, active_days: DEFAULT_ACTIVE_DAYS },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
  if (s.error) throw s.error;
  const h = await supabase.from('habits').upsert(
    DEFAULT_HABITS.map((x, position) => ({
      key: x.k,
      name: x.name,
      when_text: x.when,
      position,
      active: true,
    })),
    { onConflict: 'user_id,key', ignoreDuplicates: true },
  );
  if (h.error) throw h.error;
}

/** Días, ajustes y misiones del usuario con sesión. */
export async function loadAll(): Promise<Loaded> {
  let r = await read();
  if (!r.settings) {
    await seed();
    r = await read();
  }
  if (!r.settings) throw new Error('No se pudieron crear los ajustes');
  return {
    days: Object.fromEntries(r.days.map((x) => [x.date as string, x.habits as Habits])),
    habits: r.habits.map((x) => ({
      k: x.key as string,
      name: x.name as string,
      when: x.when_text as string,
      active: x.active as boolean,
    })),
    goal: r.settings.goal,
    freezeMin: r.settings.freeze_min,
    activeDays: r.settings.active_days,
  };
}

/** Guarda (inserta o actualiza) un día. user_id lo pone la base de datos. */
export async function saveDay(date: string, habits: Habits): Promise<void> {
  const { error } = await supabase
    .from('days')
    .upsert({ date, habits, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
  if (error) throw error;
}

// ---------- Configuración (misma tabla que el modo administrador de la web) ----------

export async function saveSettings(goal: number, freezeMin: number, activeDays: number[]): Promise<void> {
  const { error } = await supabase.from('settings').upsert(
    { goal, freeze_min: freezeMin, active_days: [...activeDays].sort(), updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

/** Crea una misión al final de la lista y devuelve su clave. */
export async function addHabit(name: string, when: string, position: number): Promise<string> {
  const key = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const { error } = await supabase
    .from('habits')
    .insert({ key, name, when_text: when, position, active: true });
  if (error) throw error;
  return key;
}

export async function updateHabit(k: string, patch: Partial<Omit<HabitItem, 'k'>>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row['name'] = patch.name;
  if (patch.when !== undefined) row['when_text'] = patch.when;
  if (patch.active !== undefined) row['active'] = patch.active;
  const { error } = await supabase.from('habits').update(row).eq('key', k);
  if (error) throw error;
}

/** Guarda el orden de la lista completa. */
export async function saveOrder(list: HabitItem[]): Promise<void> {
  const rows = list.map((h, position) => ({
    key: h.k,
    name: h.name,
    when_text: h.when,
    position,
    active: h.active,
  }));
  const { error } = await supabase.from('habits').upsert(rows, { onConflict: 'user_id,key' });
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
