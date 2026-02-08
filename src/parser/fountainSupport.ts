import { LRLanguage, syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'
import { parser } from './fountain-parser.js'

export const fountainLanguage = LRLanguage.define({
  parser,
})

const lineClassByType = new Map<string, string>([
  ['SceneHeadingLine', 'cm-fountain-scene'],
  ['ActionLine', 'cm-fountain-action'],
  ['ForcedActionLine', 'cm-fountain-action'],
  ['CharacterCue', 'cm-fountain-character'],
  ['DualCharacterCue', 'cm-fountain-character'],
  ['Parenthetical', 'cm-fountain-parenthetical'],
  ['DialogueLine', 'cm-fountain-dialogue'],
  ['TransitionLine', 'cm-fountain-transition'],
  ['SectionLine', 'cm-fountain-section'],
  ['SynopsisLine', 'cm-fountain-synopsis'],
])

const buildLineDecorations = (view: EditorView) => {
  const builder = new RangeSetBuilder<Decoration>()
  const lineClasses = new Map<number, string>()

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const className = lineClassByType.get(node.type.name)
        if (!className) return

        const line = view.state.doc.lineAt(node.from)
        if (!lineClasses.has(line.from)) {
          lineClasses.set(line.from, className)
        }
      },
    })
  }

  for (const [lineFrom, className] of lineClasses.entries()) {
    builder.add(lineFrom, lineFrom, Decoration.line({ class: className }))
  }

  return builder.finish()
}

export const fountainLineFormatting = ViewPlugin.fromClass(
  class {
    decorations: ReturnType<typeof buildLineDecorations>
    constructor(private view: EditorView) {
      this.decorations = buildLineDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildLineDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)
