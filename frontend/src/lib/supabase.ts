import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          theme: 'dark' | 'light'
          language: string
          voice_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          theme?: 'dark' | 'light'
          language?: string
          voice_enabled?: boolean
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          theme?: 'dark' | 'light'
          language?: string
          voice_enabled?: boolean
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          model: string
          is_temporary: boolean
          is_archived: boolean
          is_pinned: boolean
          parent_conversation_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          title?: string
          model?: string
          is_temporary?: boolean
          is_archived?: boolean
          is_pinned?: boolean
          parent_conversation_id?: string | null
        }
        Update: {
          title?: string
          model?: string
          is_temporary?: boolean
          is_archived?: boolean
          is_pinned?: boolean
          parent_conversation_id?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          model: string | null
          tokens_used: number | null
          audio_url: string | null
          is_edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          model?: string | null
          tokens_used?: number | null
          audio_url?: string | null
        }
        Update: {
          content?: string
          is_edited?: boolean
          audio_url?: string | null
        }
      }
      inline_annotations: {
        Row: {
          id: string
          message_id: string
          conversation_id: string
          selected_text: string
          start_offset: number
          end_offset: number
          annotation_type: 'question' | 'definition' | 'explanation' | 'translation'
          is_resolved: boolean
          created_at: string
        }
        Insert: {
          message_id: string
          conversation_id: string
          selected_text: string
          start_offset: number
          end_offset: number
          annotation_type?: 'question' | 'definition' | 'explanation' | 'translation'
        }
        Update: {
          is_resolved?: boolean
        }
      }
      inline_messages: {
        Row: {
          id: string
          annotation_id: string
          role: 'user' | 'assistant'
          content: string
          audio_url: string | null
          created_at: string
        }
        Insert: {
          annotation_id: string
          role: 'user' | 'assistant'
          content: string
          audio_url?: string | null
        }
      }
      memories: {
        Row: {
          id: string
          user_id: string
          content: string
          source_conversation_id: string | null
          source_message_id: string | null
          memory_type: 'fact' | 'preference' | 'goal' | 'context'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          content: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          memory_type?: 'fact' | 'preference' | 'goal' | 'context'
        }
        Update: {
          content?: string
          is_active?: boolean
        }
      }
    }
  }
}

/**
 * Fetches previous conversation messages and builds a structured context summary
 * for continuing discussion in a new chat.
 */
export async function getConversationContextData(conversationId: string): Promise<{
  title: string
  formattedContext: string
  messagesCount: number
}> {
  try {
    const [convRes, msgsRes] = await Promise.all([
      supabase.from('conversations').select('title').eq('id', conversationId).single(),
      supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(40)
    ])

    const title = convRes.data?.title || 'Previous Chat'
    const msgs = msgsRes.data || []

    if (msgs.length === 0) {
      return { title, formattedContext: '', messagesCount: 0 }
    }

    const formattedLines = msgs.map((m) => {
      const roleName = m.role === 'user' ? 'User' : 'Assistant'
      const truncated = m.content.length > 800 ? m.content.slice(0, 800) + '...' : m.content
      return `[${roleName}]: ${truncated}`
    })

    const formattedContext = [
      `--- CONTINUATION OF PREVIOUS CHAT: "${title}" ---`,
      `The user is continuing from an earlier conversation. Here is the conversation log from that session:`,
      ...formattedLines,
      `--- END OF PREVIOUS CHAT CONTEXT ---`,
      `Instruction: Seamlessly continue the conversation based on the above context without forcing the user to repeat past explanations.`
    ].join('\n')

    return {
      title,
      formattedContext,
      messagesCount: msgs.length
    }
  } catch (err) {
    console.error('Failed to load conversation context:', err)
    return { title: 'Previous Chat', formattedContext: '', messagesCount: 0 }
  }
}

