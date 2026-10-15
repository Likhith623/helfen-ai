'use client'

import React from 'react'
import type { PromptTemplate } from '@/store/appStore'
import {
  Sparkles, FileText, HelpCircle, Network, Code,
  Bug, Lightbulb, Languages, CheckSquare, PlusCircle
} from 'lucide-react'

interface SlashCommandPopupProps {
  commands: PromptTemplate[]
  selectedIndex: number
  onSelect: (cmd: PromptTemplate) => void
  onManageTemplates: () => void
  onClose: () => void
}

function getCommandIcon(cmd: string) {
  switch (cmd) {
    case 'summarize':
      return <FileText size={15} />
    case 'explain':
      return <HelpCircle size={15} />
    case 'diagram':
      return <Network size={15} />
    case 'refactor':
      return <Code size={15} />
    case 'fix':
      return <Bug size={15} />
    case 'brainstorm':
      return <Lightbulb size={15} />
    case 'translate':
      return <Languages size={15} />
    case 'tests':
      return <CheckSquare size={15} />
    default:
      return <Sparkles size={15} />
  }
}

export function SlashCommandPopup({
  commands,
  selectedIndex,
  onSelect,
  onManageTemplates
}: SlashCommandPopupProps) {
  if (commands.length === 0) {
    return (
      <div className="slash-popup-menu">
        <div className="slash-popup-empty">
          <span>No matching commands found</span>
          <button
            type="button"
            className="slash-popup-manage-link"
            onClick={onManageTemplates}
          >
            <PlusCircle size={13} />
            <span>Create custom template</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="slash-popup-menu" role="listbox">
      <div className="slash-popup-header">
        <span>Slash Commands & Prompts</span>
        <button
          type="button"
          className="slash-popup-manage-btn"
          onClick={onManageTemplates}
          title="Manage custom templates"
        >
          <PlusCircle size={13} />
          <span>New / Manage</span>
        </button>
      </div>

      <div className="slash-popup-list">
        {commands.map((cmd, idx) => {
          const isSelected = idx === selectedIndex
          return (
            <div
              key={cmd.id}
              className={`slash-popup-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelect(cmd)}
              onMouseEnter={() => {}}
              role="option"
              aria-selected={isSelected}
            >
              <div className="slash-item-icon-box">
                {getCommandIcon(cmd.command)}
              </div>
              <div className="slash-item-content">
                <div className="slash-item-title-row">
                  <span className="slash-item-command">/{cmd.command}</span>
                  <span className="slash-item-title">{cmd.title}</span>
                  {cmd.isCustom && <span className="slash-item-custom-badge">Custom</span>}
                </div>
                <div className="slash-item-desc">{cmd.description}</div>
              </div>
              <div className="slash-item-hint">
                {isSelected ? <kbd>↵</kbd> : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="slash-popup-footer">
        <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
        <span><kbd>Tab</kbd> or <kbd>Enter</kbd> to apply</span>
        <span><kbd>Esc</kbd> to dismiss</span>
      </div>
    </div>
  )
}
