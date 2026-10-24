# Código compartido con la app web

Estos tres archivos son una **copia** de `justme/web/src/app/habits/` (`habits.config.ts`,
`streaks.ts`) y del tipo `Habits`. Los dos proyectos son independientes, así que no se importan entre sí.

Si cambias las reglas de racha (meta, congelación, días obligatorios, formato de la hora) en la
app web, repite el cambio aquí para que ambas calculen lo mismo. El archivo `streaks.spec.ts`
de la web es la referencia de comportamiento.
