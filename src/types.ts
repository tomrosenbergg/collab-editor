// Rename 'Document' to 'Screenplay' to avoid conflicts with global DOM Document
export interface Screenplay {
  id: string
  title: string
  updated_at: string
  owner_id: string
  is_public: boolean
  content?: string
}

export interface Permission {
  id: number
  document_id: string
  user_email: string
  permission_level: 'viewer' | 'editor'
}

export interface Screenplay {
  id: string
  title: string
  updated_at: string
  owner_id: string
  is_public: boolean
  public_permission: 'viewer' | 'editor' // <--- NEW FIELD
  content?: string
}
