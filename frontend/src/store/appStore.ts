import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

export type Theme = 'dark' | 'light'

export interface UserProfile {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
}

export interface MessageAttachment {
  id: string
  name: string
  type: 'image' | 'document' | 'code'
  size: number
  mimeType: string
  dataUrl?: string
  base64?: string
  text?: string
  tokenCount?: number
}

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
  attachments?: MessageAttachment[]
  images?: string[]
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
  parent_conversation_id?: string | null
  created_at: string
  updated_at: string
}

interface AppState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void

  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void

  /* Continuation context state */
  continuationParentId: string | null
  continuationParentTitle: string | null
  continuationMessagesCount: number
  continuationContextText: string | null
  isContextModalOpen: boolean
  setContinuationParent: (
    id: string | null,
    title?: string | null,
    msgCount?: number,
    contextText?: string | null
  ) => void
  clearContinuationParent: () => void
  setIsContextModalOpen: (open: boolean) => void
  startNewChatWithContinuation: (parentId: string, parentTitle: string) => void

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

  /* Multi-modal Attachments State */
  pendingAttachments: MessageAttachment[]
  addPendingAttachment: (att: MessageAttachment) => void
  removePendingAttachment: (id: string) => void
  clearPendingAttachments: () => void

  /* Auth State */
  currentUser: { id: string; email?: string } | null
  userProfile: UserProfile | null
  isAuthModalOpen: boolean
  authModalTab: 'signin' | 'signup'
  setCurrentUser: (user: { id: string; email?: string } | null) => void
  setUserProfile: (profile: UserProfile | null) => void
  setIsAuthModalOpen: (open: boolean, tab?: 'signin' | 'signup') => void
  signOut: () => Promise<void>
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      activeConversationId: null,
      setActiveConversationId: (id) =>
        set({
          activeConversationId: id,
          messages: [],
          // Clear continuation state when loading an existing conversation
          continuationParentId: null,
          continuationParentTitle: null,
          continuationMessagesCount: 0,
          continuationContextText: null,
        }),

      continuationParentId: null,
      continuationParentTitle: null,
      continuationMessagesCount: 0,
      continuationContextText: null,
      isContextModalOpen: false,

      setContinuationParent: (id, title = null, msgCount = 0, contextText = null) =>
        set({
          continuationParentId: id,
          continuationParentTitle: title,
          continuationMessagesCount: msgCount,
          continuationContextText: contextText,
        }),

      clearContinuationParent: () =>
        set({
          continuationParentId: null,
          continuationParentTitle: null,
          continuationMessagesCount: 0,
          continuationContextText: null,
        }),

      setIsContextModalOpen: (open) => set({ isContextModalOpen: open }),

      startNewChatWithContinuation: (parentId, parentTitle) =>
        set({
          activeConversationId: null,
          messages: [],
          isTemporaryChat: false,
          continuationParentId: parentId,
          continuationParentTitle: parentTitle,
          continuationMessagesCount: 0,
          continuationContextText: null,
        }),

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

      pendingAttachments: [],
      addPendingAttachment: (att) =>
        set((state) => ({ pendingAttachments: [...state.pendingAttachments, att] })),
      removePendingAttachment: (id) =>
        set((state) => ({
          pendingAttachments: state.pendingAttachments.filter((a) => a.id !== id),
        })),
      clearPendingAttachments: () => set({ pendingAttachments: [] }),

      currentUser: null,
      userProfile: null,
      isAuthModalOpen: false,
      authModalTab: 'signin',

      setCurrentUser: (user) => set({ currentUser: user }),
      setUserProfile: (profile) => set({ userProfile: profile }),
      setIsAuthModalOpen: (open, tab = 'signin') =>
        set({ isAuthModalOpen: open, authModalTab: tab }),

      signOut: async () => {
        try {
          await supabase.auth.signOut()
        } catch (err) {
          console.error('Error signing out:', err)
        }
        set({
          currentUser: null,
          userProfile: null,
          conversations: [],
          messages: [],
          activeConversationId: null,
          continuationParentId: null,
          continuationParentTitle: null,
          continuationMessagesCount: 0,
          continuationContextText: null,
        })
      },
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
