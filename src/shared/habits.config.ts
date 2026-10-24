export interface HabitDef {
  k: string;
  name: string;
  when: string;
}

/** Misiones iniciales; se copian a la base de datos la primera vez que entra cada usuario. */
export const DEFAULT_HABITS: HabitDef[] = [
  { k: 'celular', name: 'Celular lejos al despertar', when: '7:00' },
  { k: 'leetcode', name: 'LeetCode', when: '7:40 – 8:40' },
  { k: 'grabacion', name: 'Grabarme explicando', when: '8:40 · 1 a 3 min' },
  { k: 'revisar', name: 'Revisar grabación de ayer', when: 'Huecos del trabajo' },
  { k: 'lecturas', name: 'Lecturas (2 o 3)', when: '8:40 y huecos del trabajo' },
  { k: 'ingles', name: 'Vocabulario de inglés', when: 'Huecos del trabajo' },
  { k: 'vozalta', name: 'Leer en voz alta', when: '19:00 · 10 a 15 min' },
  { k: 'proyecto', name: 'Proyecto o curso', when: '21:00 – 22:30' },
  { k: 'reto', name: 'Reto con gente', when: 'Cuando surja' },
];

/** Misiones por día para sumar a la racha. */
export const DEFAULT_GOAL = 6;
/** Días cumplidos seguidos (desde el último quiebre o congelación) para ganar una congelación. */
export const DEFAULT_FREEZE_MIN = 15;
/** Días obligatorios (0 = domingo ... 6 = sábado). Los demás no rompen la racha. */
export const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5];

export const XP_PER = 10;
export const XP_LEVEL = 200;
export const DN = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MN = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
