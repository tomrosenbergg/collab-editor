# Supabase Contracts

This app assumes the following policies and RPCs exist in Supabase.

## Required RLS Policies
`documents`
- SELECT: owner, public, or explicit permission (viewer/editor).
- UPDATE: **owner only**.

`document_permissions`
- Owners manage permissions.
- Users can read their own permissions.

## Required RPCs
### `update_document_content(p_document_id uuid, p_content_hex text)`
Used by the client to save Yjs content for editors without granting broad UPDATE.

- Validates caller is:
  - the owner, OR
  - public editor, OR
  - invited editor
- Updates:
  - `content` (hex decoded to `bytea`)
  - `updated_at`

### SQL to apply
Use `/Users/tom/Documents/collab-editor/supabase/rls_policies.sql` in the Supabase SQL editor.
