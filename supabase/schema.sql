-- =====================================================================
-- 爸爸的歌单 · Supabase
-- Tabla song_selections + Row Level Security (RLS)
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede volver a ejecutar sin perder datos (es idempotente).
-- =====================================================================

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
