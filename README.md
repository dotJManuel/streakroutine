# StreakRoutine (extensión de navegador)

La racha de tus rutinas en un popup para Chrome y Edge (Manifest V3): llama, racha actual y mejor
racha, semana, misiones del día con la hora en que se completaron, XP y congelación.
Proyecto independiente de la app web `justme`, con la que comparte el login y las tablas de Supabase.

Las misiones, la meta y los días obligatorios se editan en la app web (modo administrador).
La lógica de racha vive en `src/shared/` como copia de la de la web (ver `src/shared/README.md`).

## Compilar

```bash
npm install
npm run build
```

Genera la carpeta `dist/`. Los íconos ya están en `public/icons/`; para regenerarlos: `npm run icons`.

## Instalar en el navegador (sin publicarla)

1. Abre `chrome://extensions` (o `edge://extensions`).
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y elige la carpeta `dist` de este proyecto.
4. Fija el ícono con el puzzle de la barra de herramientas.

Tras cambiar el código: `npm run build` y pulsa ↻ en la tarjeta de la extensión.

## Notas

- El número sobre el ícono es tu racha; se actualiza cada vez que abres el popup.
- La sesión se guarda en el navegador. Si cambias la URL de Supabase en `src/config.ts`,
  actualiza también `host_permissions` en `public/manifest.json`.
- Las claves de `src/config.ts` son la clave publishable (pública por diseño). Nunca pongas la `service_role`.
