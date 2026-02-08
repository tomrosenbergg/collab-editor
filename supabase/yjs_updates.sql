-- Yjs incremental update storage

-- 1) Schema changes
alter table public.documents
add column if not exists snapshot_at timestamptz;

update public.documents
set snapshot_at = coalesce(updated_at, now())
where snapshot_at is null;

create table if not exists public.document_updates (
  id bigserial primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  update bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists document_updates_document_id_created_at_idx
  on public.document_updates (document_id, created_at);

-- 2) RLS
alter table public.document_updates enable row level security;

drop policy if exists "Allow Read Updates" on public.document_updates;
create policy "Allow Read Updates"
on public.document_updates
for select
using (
  exists (
    select 1 from public.documents d
    where d.id = document_id
      and (
        d.owner_id = auth.uid()
        or d.is_public = true
        or exists (
          select 1 from public.document_permissions dp
          where dp.document_id = d.id
            and dp.user_email = (auth.jwt() ->> 'email')
        )
      )
  )
);

-- 3) RPCs
create or replace function public.append_document_update(
  p_document_id uuid,
  p_update_hex text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.documents d
    where d.id = p_document_id
      and (
        d.owner_id = auth.uid()
        or (d.is_public = true and d.public_permission = 'editor')
        or exists (
          select 1
          from public.document_permissions dp
          where dp.document_id = d.id
            and dp.user_email = (auth.jwt() ->> 'email')
            and dp.permission_level = 'editor'
        )
      )
  ) then
    raise exception 'not authorized';
  end if;

  insert into public.document_updates (document_id, update)
  values (p_document_id, decode(p_update_hex, 'hex'));

  update public.documents
  set updated_at = now()
  where id = p_document_id;
end;
$$;

create or replace function public.compact_document_updates(
  p_document_id uuid,
  p_content_hex text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.documents d
    where d.id = p_document_id
      and (
        d.owner_id = auth.uid()
        or (d.is_public = true and d.public_permission = 'editor')
        or exists (
          select 1
          from public.document_permissions dp
          where dp.document_id = d.id
            and dp.user_email = (auth.jwt() ->> 'email')
            and dp.permission_level = 'editor'
        )
      )
  ) then
    raise exception 'not authorized';
  end if;

  update public.documents
  set content = decode(p_content_hex, 'hex'),
      updated_at = now(),
      snapshot_at = now()
  where id = p_document_id;

  delete from public.document_updates
  where document_id = p_document_id;
end;
$$;

grant execute on function public.append_document_update(uuid, text) to anon, authenticated;
grant execute on function public.compact_document_updates(uuid, text) to anon, authenticated;
