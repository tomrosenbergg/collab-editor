import { EditorState } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { yCollab } from 'y-codemirror.next'
import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'
import { fountainLanguage, fountainLineFormatting } from './fountainSupport'
import { screenplayTheme } from './screenplayTheme'

interface EditorExtensionsArgs {
  isReadOnly: boolean
  ytext: Y.Text
  awareness: Awareness
}

export const getEditorExtensions = ({ isReadOnly, ytext, awareness }: EditorExtensionsArgs) => {
  return [
    basicSetup,
    screenplayTheme,
    fountainLanguage,
    fountainLineFormatting,
    EditorState.readOnly.of(isReadOnly),
    yCollab(ytext, awareness),
    EditorView.lineWrapping,
    EditorView.scrollMargins.of((view) => {
      const dom = view.dom
      const halfHeight = dom.clientHeight / 2
      return { top: halfHeight - 10, bottom: halfHeight - 10 }
    }),
  ]
}
