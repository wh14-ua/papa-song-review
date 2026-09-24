# 爸爸的歌单 · Cancionero de papá

Web mobile-first para que papá revise su lista de canciones chinas y elija qué
versión de YouTube quiere conservar de cada una. La interfaz que ve papá está en
**chino simplificado** (con pequeños subtítulos en español); el panel `/admin`
está en español.

- **Fuente de verdad:** `public/songs.json` (142 registros → **121 canciones únicas** a revisar).
- **Guardado:** cada pulsación se guarda al instante en el navegador y se envía a
  **Supabase** si está configurado. Sin Supabase la web funciona igual.
- **Sin descargas:** la web solo sirve para elegir. La descarga (yt-dlp) se hará
  más tarde con un script local a partir del JSON exportado.

Stack: React 19 · TypeScript 6 (estricto) · Vite 8 · Supabase (`supabase-js`) ·
CSS propio · Vitest · oxlint. Sitio 100 % estático (Cloudflare Pages, Vercel o
GitHub Pages).

---

## Índice

1. [Qué hace](#qué-hace)
2. [Puesta en marcha](#puesta-en-marcha)
3. [El dataset](#el-dataset-publicsongsjson)
4. [Guardado, sesión y sincronización](#guardado-sesión-y-sincronización)
5. [Supabase](#supabase)
6. [Despliegue](#despliegue)
7. [Exportación](#exportación-para-el-script-de-descarga)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Cómo se ha verificado](#cómo-se-ha-verificado)

---

## Qué hace

### Para papá

- **Portada** `爸爸的歌单`: «这些歌是之前记下来的。请听一下每个版本，然后选您想要的那个。»
  con **开始**, o **继续上次 73 / 121** + **从头查看** si ya hay progreso, y el
  resumen ✅ 已选好 · ❌ 都不是 · ❓ 不是这首歌 · 🔎 再找找 · ⏭️ 还没选.
- **Cada canción** (`/song/<id>`):
  - posición (`33 / 121`), barra de progreso y % completado;
  - título identificado, artista y año (y el idioma si no es mandarín);
  - **lo que papá escribió** (`您原来写的`), con letra tipo manuscrita;
  - aviso si conviene confirmar (`needs_father_review`) o si hay dudas (`manual_review`);
  - cada versión: miniatura → al pulsar se convierte en reproductor (**solo un
    vídeo cargado a la vez**), tipo (官方MV, 录音室版, 现场版…), título, artista,
    canal, **▶ 听一听**, **在 YouTube 打开** y el botón grande **✅ 就这个**;
  - si YouTube no deja insertar un vídeo (p. ej. `YmSw5i5GLC4`), la web lo
    detecta y le dice en chino que use «在 YouTube 打开»;
  - **❌ 都不是 · 🔎 再找找 · ❓ 不是这首歌 · ⏭️ 暂时跳过** (saltar pasa a la siguiente);
  - nota opcional (📝 写备注) con guardado automático, sin botón «enviar»;
  - barra fija abajo: **← 上一首 / 下一首 →**; el botón «atrás» del móvil vuelve a la portada.
- **Casos dudosos** (`manual_review`): el título pasa a ser **el texto de papá**
  («您写的是：「一瞬间」») y las versiones se agrupan por posible canción
  —**可能是 A / B / C…**, en el mismo orden que `manual_review_question_zh`—
  para que elija primero *qué canción era* y luego *qué grabación*. Las opciones
  sin vídeo en YouTube aparecen igualmente, con un botón **🔎 就是这首，请帮我找**
  que guarda «再找找» y una nota como «可能是 E：《随缘》杨崇荣».
- **Lista de canciones** (`/list`) para saltar a cualquiera y filtrar las pendientes.
- **Final** (`/done`): **完成了 🎉** + resumen (o «还差一点» si quedan pendientes).

### Para ti: `/admin`

- Sesión, modo de guardado (Supabase o solo navegador), última sincronización,
  cambios pendientes de subir y último error.
- Comprobación del dataset: registros, duplicados y canciones únicas (**121 ✓**).
- Resumen: Total, Selected, None, Wrong song, Search more, Skipped, Pending.
- **Descargar JSON** y **Descargar CSV** (opcionalmente con los 21 duplicados).
- Tabla con todas las canciones, su estado, el vídeo elegido y las notas.

---

## Puesta en marcha

Requisitos: **Node.js ≥ 20.19** (recomendado 22, ver `.nvmrc`).

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm run build      # comprueba tipos (tsc) y genera dist/
npm run preview    # sirve dist/ en http://localhost:4173
npm run lint       # oxlint (incluye reglas de React y de accesibilidad)
npm test           # tests unitarios (Vitest)
npm run check      # lint + tests + build de una vez
```

Sin variables de entorno la web funciona guardando en `localStorage`. Para
Supabase, copia `.env.example` a `.env.local` y rellénalo (ver [Supabase](#supabase)).

---

## El dataset (`public/songs.json`)

- Es la **fuente de verdad** y **no se modifica**: es una copia exacta
  (mismo SHA-256) de `data-source/songs_with_youtube_1.json`. Se descarga al abrir
  la web, así que para actualizarlo basta con sustituir el archivo y volver a desplegar.
- `data-source/` guarda los originales de la investigación (ese JSON y los CSV de
  revisión). Está en `.gitignore`: no se sube a GitHub ni se despliega.
- **Canciones a revisar:** solo los registros con `duplicate_of == null` → **121**
  (se contrasta con `counts.unique_songs`; `/admin` avisa si no coincide). Orden
  por `id`.
- **Duplicados:** no se revisan; **heredan** la elección de su registro canónico
  (en la exportación y si alguien abre `/song/<id-duplicado>`, que redirige al canónico).
- **Agrupación por interpretación** (`song_ref`):
  - `main` = A (la identificación principal); cada `alt:<título> (<artista>)` =
    B, C… en el orden de `alternatives`, que es el mismo orden de las letras de
    `manual_review_question_zh`;
  - con `manual_review` se muestran **todas** las opciones con nombre, también
    las que no tienen vídeo (ver `youtube_alternatives_check`);
  - sin `manual_review` solo se muestran las interpretaciones que tienen vídeo,
    como «最可能是这首» / «也可能是这首»;
  - un `song_ref` que no está en `alternatives` (caso real: canción 117,
    «时间能不能走慢点（青春别散场live大合唱版） (Lee 木子)») se muestra como un grupo más.
- **Enlaces:** solo URLs `https://` de YouTube; si alguna no lo fuera, se
  reconstruye a partir del `video_id` (en el dataset actual no pasa).

---

## Guardado, sesión y sincronización

- **Cada pulsación se guarda al instante** en `localStorage` y, si hay Supabase,
  se hace **upsert inmediato** en `song_selections`. No hay botón «Submit».
- **Sin Supabase:** todo queda en el navegador de ese móvil. Cuando configures
  Supabase y vuelvas a desplegar, **lo guardado en local se sube solo**.
- **Si Supabase falla** (sin cobertura, caída…): los cambios quedan en una cola de
  pendientes que **sobrevive a cerrar la web** y se reintenta sola (2 s, 5 s, 15 s,
  30 s y luego cada minuto), además de al recuperar la conexión o volver a la
  pestaña. Papá ve «✓ 已保存» igualmente y un discreto «⏳ 待上传 N».
- **Varios dispositivos:** en caso de conflicto **gana el cambio más reciente**
  (`updated_at`). Nada guardado en un móvil se pierde: si una fila falta en
  Supabase, se vuelve a subir.
- **Sesión:** centralizada en `src/config.ts` (`DEFAULT_SESSION_ID = 'papa'`).
  - Para cambiarla en un despliegue: variable `VITE_REVIEW_SESSION_ID`.
  - **Para probar sin tocar el progreso de papá:** abre la web con
    `?session=prueba` (se recuerda en esa pestaña; `/admin?session=prueba` también).
- **Empezar de cero:** usa una sesión nueva, o borra las filas en Supabase **y**
  los datos del sitio en el navegador del móvil (si no, el móvil vuelve a subir su copia).

---

## Supabase

### 1. Crear el proyecto

1. Entra en <https://supabase.com> → **New project**.
2. Elige nombre, contraseña de la base de datos y una región cercana
   (p. ej. *West EU (Ireland)* o *Central EU (Frankfurt)*) → **Create new project**.

### 2. Crear la tabla y la seguridad (RLS)

Abre **SQL Editor → New query**, pega el contenido de
[`supabase/schema.sql`](supabase/schema.sql) (es exactamente este SQL) y pulsa
**Run**. Se puede volver a ejecutar sin perder datos.

```sql
-- 1) Tabla ------------------------------------------------------------

create table if not exists public.song_selections (
  id                uuid        primary key default gen_random_uuid(),
  session_id        text        not null,
  song_id           integer     not null,
  status            text        not null,
  selected_video_id text,
  selected_url      text,
  selected_title    text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Una fila por canción y sesión: la web hace upsert sobre esta clave.
  constraint song_selections_session_song_key unique (session_id, song_id),

  constraint song_selections_status_check
    check (status in ('selected', 'none', 'wrong_song', 'search_more', 'skipped')),
  constraint song_selections_session_id_check
    check (session_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint song_selections_song_id_check
    check (song_id between 1 and 100000),
  -- "selected" siempre lleva el vídeo elegido
  constraint song_selections_selected_video_check
    check (status <> 'selected' or selected_video_id is not null),
  -- Solo enlaces de YouTube
  constraint song_selections_url_check
    check (selected_url is null or selected_url ~ '^https://(www\.|m\.|music\.)?(youtube\.com|youtu\.be)/'),
  constraint song_selections_lengths_check
    check (
      char_length(coalesce(selected_video_id, '')) <= 32
      and char_length(coalesce(selected_url, '')) <= 300
      and char_length(coalesce(selected_title, '')) <= 500
      and char_length(coalesce(notes, '')) <= 2000
    )
);

comment on table public.song_selections is
  'Elección de papá para cada canción canónica de public/songs.json (una fila por session_id + song_id).';

-- 2) Row Level Security ------------------------------------------------
-- La web usa la clave pública (anon / publishable) y el session_id
-- ('papa' por defecto, ?session=prueba para pruebas).
-- anon puede leer, crear y actualizar. Nunca borrar ni vaciar la tabla.

alter table public.song_selections enable row level security;

revoke all on table public.song_selections from anon, authenticated;
grant select, insert, update on table public.song_selections to anon;

-- El upsert (INSERT … ON CONFLICT DO UPDATE) necesita las tres políticas.
drop policy if exists "anon puede leer" on public.song_selections;
create policy "anon puede leer"
  on public.song_selections
  for select
  to anon
  using (true);

drop policy if exists "anon puede crear" on public.song_selections;
create policy "anon puede crear"
  on public.song_selections
  for insert
  to anon
  with check (true);

drop policy if exists "anon puede actualizar" on public.song_selections;
create policy "anon puede actualizar"
  on public.song_selections
  for update
  to anon
  using (true)
  with check (true);

-- Sin política DELETE (ni permiso): desde la web no se puede borrar nada.
-- Para empezar de cero, bórralo desde el panel de Supabase (Table Editor) o con:
--   delete from public.song_selections where session_id = 'prueba';
```

### 3. Qué protege la RLS (y qué no)

| Con la clave pública (anon / publishable) | ¿Permitido? |
|---|---|
| Leer, crear y actualizar selecciones (con su `session_id`) | ✅ |
| Borrar filas o vaciar la tabla | ❌ (sin permiso ni política) |
| Estados fuera de `selected / none / wrong_song / search_more / skipped` | ❌ (CHECK) |
| `selected` sin vídeo, URLs que no sean de YouTube, textos enormes | ❌ (CHECK) |

La web usa `session_id = 'papa'` (o la sesión de `?session=`). Como no hay cuentas
de usuario, **cualquiera que tenga la URL de la web** podría leer o cambiar las
selecciones (nunca borrarlas). Para una web familiar privada es un riesgo
asumible: no compartas el enlace públicamente. La web además lleva
`<meta name="robots" content="noindex">`.

### 4. Variables de entorno

En el panel del proyecto, botón **Connect** (o **Project Settings → API Keys**):

- **Project URL** → `VITE_SUPABASE_URL` (p. ej. `https://abcdefgh.supabase.co`)
- **Publishable key** (`sb_publishable_…`) o la **anon key** heredada →
  `VITE_SUPABASE_ANON_KEY`

```bash
cp .env.example .env.local
# y edita .env.local:
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxx
```

> ⚠️ **Nunca** pongas la `service_role` ni una `secret key` (`sb_secret_…`): todo lo
> que empieza por `VITE_` acaba en el JavaScript público. La web **se niega a usar**
> esas claves y lo avisa en `/admin` (si ocurriera, rota esa clave en Supabase).
> `.env.local` está en `.gitignore`: no se sube a GitHub.

Las variables se incrustan **al compilar**: después de cambiarlas, vuelve a
desplegar.

### 5. Comprobarlo

Abre `/admin`: en «Guardado» debe poner **Sincronizado con Supabase**. Elige una
versión en cualquier canción y la verás en **Table Editor → song_selections**.

---

## Despliegue

En los tres casos el resultado es un sitio estático (`dist/`). Configura
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en la plataforma (o déjalas vacías
para usar solo `localStorage`). Primero sube el código a GitHub:

```bash
git init
git add -A
git commit -m "Cancionero de papá"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
git push -u origin main
```

### Cloudflare Pages

1. Panel de Cloudflare → **Workers & Pages** → **Create** → pestaña **Pages** →
   **Connect to Git** e importa el repositorio.
2. Configuración de build:
   - Framework preset: **React (Vite)** (o *None*)
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Environment variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
   (en *Production* y, si quieres, *Preview*). La versión de Node se toma de
   `.nvmrc` (22); también puedes fijarla con `NODE_VERSION=22`.
4. **Save and Deploy**. Cada `git push` vuelve a desplegar.

Las rutas como `/admin` funcionan solas: Cloudflare Pages trata el proyecto como
SPA porque no hay un `404.html` en `dist/`.

Alternativa por línea de comandos (sube la carpeta ya compilada):

```bash
npm run build
npx wrangler pages deploy dist --project-name cancionero-papa
```

### Vercel

1. <https://vercel.com/new> → **Import** el repositorio de GitHub.
2. Framework: **Vite** (lo detecta solo). `vercel.json` ya fija
   `npm run build` → `dist` y la reescritura de rutas a `index.html` (para `/admin`,
   `/song/37`…).
3. **Environment Variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. Cada `git push` a `main` despliega producción.

Por línea de comandos: `npx vercel` (preview) y `npx vercel --prod`.

### GitHub Pages (opcional)

1. **Settings → Pages → Source: GitHub Actions**.
2. Si usas Supabase: **Settings → Secrets and variables → Actions → Variables**
   → `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. **Actions → Deploy to GitHub Pages → Run workflow**
   (`.github/workflows/deploy-pages.yml`, solo se lanza a mano).

El workflow compila con la base `/<nombre-del-repo>/` y copia `index.html` como
`404.html` para que funcionen las rutas directas. Para compilarlo en local:
`BASE_PATH=/<nombre-del-repo>/ npm run build:gh-pages`.

---

## Exportación (para el script de descarga)

En `/admin` → **Descargar JSON** / **Descargar CSV**
(`seleccion-papa-AAAA-MM-DD.json|csv`). Una fila por canción, en orden de `song_id`:

```json
[
  {
    "song_id": 37,
    "title": "一千个伤心的理由",
    "artist": "张学友",
    "video_id": "Yl9sIjmaZP8",
    "youtube_url": "https://www.youtube.com/watch?v=Yl9sIjmaZP8",
    "status": "selected",
    "video_title": "張學友 - 一千個傷心的理由 (Official Video)",
    "notes": null,
    "source_text": "一个1000个伤心的理由",
    "duplicate_of": null,
    "duplicate_ids": [74]
  }
]
```

- Los 6 primeros campos son los acordados; el resto es información adicional.
- `status`: `selected`, `none`, `wrong_song`, `search_more`, `skipped` o
  `pending` (sin ninguna acción todavía).
- `title` / `artist`: los de la **interpretación que eligió papá** (si eligió una
  alternativa, p. ej. «忘不了的人» de 陈浩民, se exporta esa) y el artista del vídeo
  elegido. `video_id` / `youtube_url` solo con `selected`.
- `duplicate_ids`: registros duplicados que heredan esta elección. Marcando
  «Incluir también los 21 duplicados» se exportan las 142 filas, con
  `duplicate_of` = id del canónico en las heredadas.
- El CSV usa UTF-8 con BOM (Excel muestra bien el chino) y las mismas columnas
  (`duplicate_ids` separados por espacios).

Para el futuro script de descarga: filtrar `status == "selected"` y, si exportas
con duplicados, descargar cada `video_id` una sola vez.

---

## Estructura del proyecto

```
├── public/
│   ├── songs.json                 # dataset (fuente de verdad)
│   ├── favicon.svg, icon-*.png, apple-touch-icon.png, manifest.webmanifest
├── src/
│   ├── main.tsx                   # arranque: sesión, Supabase, almacén
│   ├── App.tsx                    # rutas y mensajes breves
│   ├── config.ts                  # sesión ("papa") y variables de Supabase
│   ├── types.ts                   # tipos del dataset y de las selecciones
│   ├── labels.ts                  # textos en chino (+ subtítulos en español)
│   ├── data/
│   │   ├── catalog.ts             # valida songs.json, canónicas, duplicados, grupos A/B/C
│   │   ├── progress.ts            # contadores, % y dónde continuar
│   │   └── export.ts              # filas JSON/CSV (con herencia de duplicados)
│   ├── storage/
│   │   ├── selectionStore.ts      # guardado inmediato + cola + reintentos + fusión
│   │   ├── localPersistence.ts    # localStorage
│   │   ├── supabaseGateway.ts     # select + upsert (supabase-js, carga diferida)
│   │   └── remote.ts
│   ├── lib/                       # rutas, reproductor de YouTube, descargas
│   ├── app/                       # contexto de React y carga del dataset
│   ├── components/                # portada, tarjetas, grupos, botones, nota…
│   ├── screens/                   # Home, Review, Done, SongList, Admin
│   ├── styles/                    # CSS (tokens con modo claro/oscuro)
│   └── test/fakes.ts              # dobles de prueba (localStorage y Supabase)
├── supabase/schema.sql            # tabla + RLS
├── .github/workflows/deploy-pages.yml
├── vercel.json, vite.config.ts, vitest.config.ts, .oxlintrc.json, tsconfig*.json
├── .env.example, .nvmrc
└── data-source/                   # originales (JSON + CSV); en .gitignore, no se suben
```

---

## Cómo se ha verificado

- `npm run lint`, `npm test` (97 tests) y `npm run build` sin errores ni avisos.
- Tests con el `songs.json` real: se carga, se filtran los duplicados, quedan
  exactamente **121** canciones, los 473 vídeos aparecen una sola vez, grupos A–E
  de «一瞬间», grupo extra de la canción 117, herencia de duplicados en la
  exportación, CSV con comillas/comas/saltos de línea, sesión, rutas y el rechazo
  de claves `service_role`.
- Almacén: persistencia en `localStorage`, cola de pendientes, reintentos,
  subida de lo hecho sin Supabase, conflictos entre dispositivos y una carrera
  descarga/subida (con prueba de mutación).
- En navegador (Chromium a 390×844 y 360×780, modo claro y oscuro): portada,
  anterior/siguiente, elegir y cambiar una selección anterior, saltar, notas,
  recarga sin perder nada, reproductor (un solo iframe), detección del vídeo con
  inserción desactivada, lista, `/done`, `/admin`, descarga real de JSON/CSV y
  despliegue bajo subdirectorio (GitHub Pages).
- `supabase/schema.sql` ejecutado dos veces en PostgreSQL 16 con los roles de
  Supabase y probado contra **PostgREST v12**: con la clave pública se puede leer,
  crear y actualizar (upsert) y no se puede borrar ni vaciar la tabla. La web,
  probada de extremo a extremo contra ese stack: carga del progreso en un
  dispositivo nuevo, upsert inmediato, caída del servidor → «⏳ 待上传» → subida
  automática al volver, y subida de lo guardado solo en local.
