'use client'

import { useState } from 'react'
import { useAppStore, type PromptTemplate } from '@/store/appStore'
import {
  saveCustomTemplateToSupabase,
  deleteCustomTemplateFromSupabase,
  BUILTIN_SLASH_COMMANDS
} from '@/lib/slashCommands'
import {
  X, Plus, Sparkles, Trash2, Command, FileText, Check, HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

export function PromptTemplateModal() {
  const {
    isTemplateManagerOpen,
    setIsTemplateManagerOpen,
    customTemplates,
    addCustomTemplate,
    removeCustomTemplate,
    currentUser
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<'custom' | 'builtin'>('custom')
  const [isCreating, setIsCreating] = useState(false)

  // Form state
  const [command, setCommand] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isTemplateManagerOpen) return null

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!command.trim() || !title.trim() || !template.trim()) {
      toast.error('Command, title, and prompt template are required')
      return
    }

    const cleanCommand = command.trim().toLowerCase().replace(/^\//, '').replace(/\s+/g, '-')

    setIsSubmitting(true)
    try {
      const saved = await saveCustomTemplateToSupabase({
        command: cleanCommand,
        title: title.trim(),
        description: description.trim(),
        template: template.trim(),
        isCustom: true
      })

      if (saved) {
        addCustomTemplate(saved)
        toast.success(`Created /${cleanCommand} template!`)
        setCommand('')
        setTitle('')
        setDescription('')
        setTemplate('')
        setIsCreating(false)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to save template')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string, cmdName: string) {
    try {
      await deleteCustomTemplateFromSupabase(id)
      removeCustomTemplate(id)
      toast.success(`Deleted /${cmdName}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete template')
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => setIsTemplateManagerOpen(false)}>
      <div className="template-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="template-modal-header">
          <div className="template-modal-title-group">
            <div className="template-modal-icon">
              <Command size={18} />
            </div>
            <div>
              <h2 className="template-modal-title">Prompt Templates & Commands</h2>
              <p className="template-modal-subtitle">
                Type <code>/</code> in the chat box to quickly invoke these templates
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsTemplateManagerOpen(false)}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="template-modal-tabs">
          <button
            type="button"
            className={`template-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            <span>My Custom Snippets ({customTemplates.length})</span>
          </button>
          <button
            type="button"
            className={`template-tab-btn ${activeTab === 'builtin' ? 'active' : ''}`}
            onClick={() => setActiveTab('builtin')}
          >
            <span>Built-in Commands ({BUILTIN_SLASH_COMMANDS.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="template-modal-body">
          {activeTab === 'custom' ? (
            <div>
              {/* Toggle create form button */}
              {!isCreating && (
                <div style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    className="template-new-btn"
                    onClick={() => setIsCreating(true)}
                  >
                    <Plus size={16} />
                    <span>Create New Slash Command</span>
                  </button>
                </div>
              )}

              {/* Create Template Form */}
              {isCreating && (
                <form onSubmit={handleCreateTemplate} className="template-form-card">
                  <div className="template-form-header">
                    <strong>New Prompt Template</strong>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setIsCreating(false)}
                      style={{ width: 24, height: 24 }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="template-form-grid">
                    <div className="template-input-group">
                      <label>Command Trigger (e.g. <code>audit</code> for <code>/audit</code>)</label>
                      <div className="template-prefix-input">
                        <span className="template-prefix">/</span>
                        <input
                          type="text"
                          placeholder="code-review"
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="template-input-group">
                      <label>Display Title</label>
                      <input
                        type="text"
                        placeholder="Security Code Review"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="template-input-group">
                    <label>Short Description (Optional)</label>
                    <input
                      type="text"
                      placeholder="Audits code for security vulnerabilities and best practices"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="template-input-group">
                    <div className="template-label-row">
                      <label>Prompt Template</label>
                      <span className="template-hint">Use <code>{'{input}'}</code> where user query should be inserted</span>
                    </div>
                    <textarea
                      rows={4}
                      placeholder="Please perform a comprehensive security and vulnerability audit on the following code:\n\n{input}"
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="template-form-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setIsCreating(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Saving...' : 'Save Template'}
                    </button>
                  </div>
                </form>
              )}

              {/* Custom Templates List */}
              <div className="template-list">
                {customTemplates.length === 0 && !isCreating ? (
                  <div className="template-empty-state">
                    <Sparkles size={32} style={{ color: 'var(--blue)', opacity: 0.6 }} />
                    <p>No custom prompt templates yet.</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Create custom shortcuts to speed up your recurring prompts and workflows.
                    </p>
                  </div>
                ) : (
                  customTemplates.map((t) => (
                    <div key={t.id} className="template-item-card">
                      <div className="template-item-main">
                        <div className="template-item-badge">/{t.command}</div>
                        <div className="template-item-details">
                          <div className="template-item-title">{t.title}</div>
                          {t.description && (
                            <div className="template-item-desc">{t.description}</div>
                          )}
                          <div className="template-item-snippet">{t.template}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="template-delete-btn"
                        onClick={() => handleDelete(t.id, t.command)}
                        title="Delete template"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Builtin Templates List */
            <div className="template-list">
              {BUILTIN_SLASH_COMMANDS.map((t) => (
                <div key={t.id} className="template-item-card builtin">
                  <div className="template-item-main">
                    <div className="template-item-badge builtin">/{t.command}</div>
                    <div className="template-item-details">
                      <div className="template-item-title">{t.title}</div>
                      <div className="template-item-desc">{t.description}</div>
                      <div className="template-item-snippet">{t.template}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
