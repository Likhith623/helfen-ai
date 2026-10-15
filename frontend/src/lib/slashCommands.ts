import { supabase } from '@/lib/supabase'
import type { PromptTemplate } from '@/store/appStore'

export const BUILTIN_SLASH_COMMANDS: PromptTemplate[] = [
  {
    id: 'cmd-summarize',
    command: 'summarize',
    title: 'Summarize',
    description: 'Quick executive summary with bullet points and takeaways',
    template: 'Please provide a clear and concise executive summary of the following content, highlighting key takeaways and action items:\n\n{input}'
  },
  {
    id: 'cmd-explain',
    command: 'explain',
    title: 'Explain Simply',
    description: 'ELI5 explanation with intuitive real-world analogies',
    template: 'Explain the following concept in simple, easy-to-understand terms with a relatable real-world analogy:\n\n{input}'
  },
  {
    id: 'cmd-diagram',
    command: 'diagram',
    title: 'Mermaid Diagram',
    description: 'Generate an architecture or flowchart in Mermaid syntax',
    template: 'Create a clean, visual Mermaid diagram illustrating the architecture, system flow, or concepts described below. Enclose the diagram inside a ```mermaid code block:\n\n{input}'
  },
  {
    id: 'cmd-refactor',
    command: 'refactor',
    title: 'Refactor Code',
    description: 'Clean, optimize, and modernize code with explanations',
    template: 'Review and refactor the following code for better performance, maintainability, and modern best practices. Explain what changes were made and why:\n\n{input}'
  },
  {
    id: 'cmd-fix',
    command: 'fix',
    title: 'Debug & Fix',
    description: 'Identify bugs or errors and provide a working fix',
    template: 'Identify any bugs, logic errors, or syntax issues in the following code/text. Explain the root cause and provide the corrected version:\n\n{input}'
  },
  {
    id: 'cmd-brainstorm',
    command: 'brainstorm',
    title: 'Brainstorm Ideas',
    description: 'Generate creative, unconventional solutions and ideas',
    template: 'Brainstorm 5 to 8 creative, high-impact, and out-of-the-box ideas or solutions for the following challenge:\n\n{input}'
  },
  {
    id: 'cmd-tests',
    command: 'tests',
    title: 'Write Tests',
    description: 'Generate unit tests covering edge cases and failures',
    template: 'Generate comprehensive unit tests for the following code, covering happy paths, edge cases, and error conditions:\n\n{input}'
  },
  {
    id: 'cmd-translate',
    command: 'translate',
    title: 'Translate',
    description: 'Translate text accurately preserving nuances and tone',
    template: 'Translate the following text accurately into English (or the requested target language), preserving natural tone and idiomatic phrasing:\n\n{input}'
  }
]

/**
 * Returns all available slash commands (built-in + user custom)
 */
export function getAllCommands(customTemplates: PromptTemplate[] = []): PromptTemplate[] {
  return [...BUILTIN_SLASH_COMMANDS, ...customTemplates]
}

/**
 * Filter slash commands matching user query (e.g. typing "/sum" or "/diag")
 */
export function filterCommands(query: string, customTemplates: PromptTemplate[] = []): PromptTemplate[] {
  const cleanQuery = query.toLowerCase().replace(/^\//, '').trim()
  const all = getAllCommands(customTemplates)
  if (!cleanQuery) return all

  return all.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(cleanQuery) ||
      cmd.title.toLowerCase().includes(cleanQuery) ||
      cmd.description.toLowerCase().includes(cleanQuery)
  )
}

/**
 * Applies a prompt template to user-provided input text
 */
export function applyCommandTemplate(template: PromptTemplate, userParam: string): string {
  const trimmedParam = userParam.trim()
  if (template.template.includes('{input}')) {
    return template.template.replace('{input}', trimmedParam || '(Refer to previous messages or documents)')
  }
  return trimmedParam ? `${template.template}\n\n${trimmedParam}` : template.template
}

/**
 * Fetch custom prompt templates from Supabase with graceful fallback
 */
export async function fetchCustomTemplatesFromSupabase(): Promise<PromptTemplate[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((d: any) => ({
      id: d.id,
      command: d.command,
      title: d.title,
      description: d.description || '',
      template: d.template,
      isCustom: true,
      isFavorite: d.is_favorite
    }))
  } catch (err) {
    console.warn('Failed to load custom prompt templates from Supabase:', err)
    return []
  }
}

/**
 * Save a custom prompt template to Supabase with graceful fallback
 */
export async function saveCustomTemplateToSupabase(
  template: Omit<PromptTemplate, 'id'> & { id?: string }
): Promise<PromptTemplate | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const payload = {
      user_id: user.id,
      command: template.command.toLowerCase().replace(/^\//, ''),
      title: template.title,
      description: template.description,
      template: template.template,
      is_favorite: template.isFavorite ?? false,
      updated_at: new Date().toISOString()
    }

    if (template.id && !template.id.startsWith('local-')) {
      const { data, error } = await supabase
        .from('prompt_templates')
        .update(payload)
        .eq('id', template.id)
        .select()
        .single()

      if (error) throw error
      return {
        id: data.id,
        command: data.command,
        title: data.title,
        description: data.description,
        template: data.template,
        isCustom: true,
        isFavorite: data.is_favorite
      }
    } else {
      const { data, error } = await supabase
        .from('prompt_templates')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return {
        id: data.id,
        command: data.command,
        title: data.title,
        description: data.description,
        template: data.template,
        isCustom: true,
        isFavorite: data.is_favorite
      }
    }
  } catch (err) {
    console.warn('Supabase save template fallback:', err)
    // Fallback to local template
    return {
      id: template.id || `local-${Date.now()}`,
      command: template.command.toLowerCase().replace(/^\//, ''),
      title: template.title,
      description: template.description,
      template: template.template,
      isCustom: true,
      isFavorite: template.isFavorite ?? false
    }
  }
}

/**
 * Delete a custom template from Supabase
 */
export async function deleteCustomTemplateFromSupabase(id: string): Promise<boolean> {
  try {
    if (id.startsWith('local-')) return true
    const { error } = await supabase.from('prompt_templates').delete().eq('id', id)
    return !error
  } catch (err) {
    console.warn('Supabase delete template error:', err)
    return true
  }
}
