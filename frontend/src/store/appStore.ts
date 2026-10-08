import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string | null
  audio_url?: string | null
  is_edited?: boolean
  created_at: string
  annotations?: InlineAnnotation[]
}

export interface InlineAnnotation {
  id: string
  message_id: string
  conversation_id: string
  selected_text: string
  start_offset: number
  end_offset: number
  annotation_type: 'question' | 'definition' | 'explanation' | 'translation'
  is_resolved: boolean
  created_at: string
  messages?: InlineMessage[]
}

export interface InlineMessage {
  id: string
  annotation_id: string
  role: 'user' | 'assistant'
  content: string
  audio_url?: string | null
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  model: string
  is_temporary: boolean
  is_archived: boolean
  is_pinned: boolean
  created_at: string
  updated_at: string
}

interface AppState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void

  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void

  conversations: Conversation[]
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  removeConversation: (id: string) => void

  messages: Message[]
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void

  annotations: Record<string, InlineAnnotation[]>
  setAnnotations: (messageId: string, annotations: InlineAnnotation[]) => void
  addAnnotation: (messageId: string, annotation: InlineAnnotation) => void
  updateAnnotation: (annotationId: string, updates: Partial<InlineAnnotation>) => void

  isStreaming: boolean
  setIsStreaming: (v: boolean) => void

  streamingMessageId: string | null
  setStreamingMessageId: (id: string | null) => void

  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void

  selectedModel: string
  setSelectedModel: (model: string) => void

  isTemporaryChat: boolean
  setIsTemporaryChat: (v: boolean) => void

  voiceEnabled: boolean
  setVoiceEnabled: (v: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      activeConversationId: null,
      setActiveConversationId: (id) => set({ activeConversationId: id, messages: [] }),

      conversations: [],
      setConversations: (conversations) => set({ conversations }),
      addConversation: (conversation) =>
        set((state) => ({ conversations: [conversation, ...state.conversations] })),
      updateConversation: (id, updates) =>
        set((state) => ({
          conversations: state.conversations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      removeConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        })),

      messages: [],
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),

      annotations: {},
      setAnnotations: (messageId, annotations) =>
        set((state) => ({ annotations: { ...state.annotations, [messageId]: annotations } })),
      addAnnotation: (messageId, annotation) =>
        set((state) => ({
          annotations: {
            ...state.annotations,
            [messageId]: [...(state.annotations[messageId] || []), annotation],
          },
        })),
      updateAnnotation: (annotationId, updates) =>
        set((state) => {
          const newAnnotations = { ...state.annotations }
          for (const key in newAnnotations) {
            newAnnotations[key] = newAnnotations[key].map((a) =>
              a.id === annotationId ? { ...a, ...updates } : a
            )
          }
          return { annotations: newAnnotations }
        }),

      isStreaming: false,
      setIsStreaming: (v) => set({ isStreaming: v }),

      streamingMessageId: null,
      setStreamingMessageId: (id) => set({ streamingMessageId: id }),

      sidebarOpen: true,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),

      selectedModel: 'llama3.2:3b',
      setSelectedModel: (model) => set({ selectedModel: model }),

      isTemporaryChat: false,
      setIsTemporaryChat: (v) => set({ isTemporaryChat: v }),

      voiceEnabled: true,
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
    }),
    {
      name: 'helfen-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        selectedModel: state.selectedModel,
        voiceEnabled: state.voiceEnabled,
      }),
    }
  )
)
