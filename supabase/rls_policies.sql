-- Tighten UPDATE privileges and provide a safe content-update RPC.
-- Apply in Supabase SQL editor.

-- 1) Ensure only owners can update documents directly.
drop policy if exists "Allow Update" on public.documents;
create policy "Allow Update (Owner Only)"
on public.documents
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- 2) Allow editors to update content via a security-definer function.
create or replace function public.update_document_content(
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
      updated_at = now()
  where id = p_document_id;
end;
$$;

grant execute on function public.update_document_content(uuid, text) to anon, authenticated;
