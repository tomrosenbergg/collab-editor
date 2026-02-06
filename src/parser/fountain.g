@precedence { p1 @left, p2 @left, p3 @left }


@top Screenplay { TitlePage? (Boneyard | Element)+ }

Element {
    ActionLine |
    ForcedActionLine |
    CenterLine |
    CharacterBlock |
    DualCharacterBlock |
    EmptyLine |
    ForceTransition |
    SceneHeadingLine |
    SectionLine |
    SynopsisLine |
    TransitionLine |
    PageBreakLine
}


// --- Boneyard ---

Boneyard { !p1 BoneStart Element* BoneEnd}


// --- Title Page Rules ---
// A title page contains one or more TitleKey:TitleValue pairs. The block ends with two newlines

TitlePage { (TitleKey TitleValue Newline)+ EmptyLine EmptyLine }



// --- Character & Dialogue Rules ---

CharacterBlock { 
   CharacterCue
   Newline
   (DialogueLine Newline | Parenthetical Newline)+
}

CharacterCue {
  Character
  ( WhiteSpace | LineParenthetical )* 
}

DualCharacterBlock {
  DualCharacterCue
  Newline
  (DialogueLine Newline | Parenthetical Newline)+
}

DualCharacterCue {
  DualCharacter
  (WhiteSpace | LineParenthetical)* 
}

Parenthetical { !p2 LParen Inline+ RParen }

DialogueLine { !p1 Inline+ }



// --- Other Rules ---

SceneHeadingLine { SceneHeading (Inline | LineParenthetical)* SceneNumber? Newline }

LineParenthetical { !p2 LParen Inline+ RParen } // stuff that's not in a dialogueblock

ActionLine { !p2 (LineParenthetical | Inline)+ Newline }

ForcedActionLine { !p2 ForceActionMark (LineParenthetical | Inline)+ Newline }

PageBreakLine { !p1 PageBreak Newline }

TransitionLine { !p1 Transition Newline }

SectionLine { !p2 SectionMark+ (LineParenthetical | Inline)* Newline}

SynopsisLine { !p1 SynopsisMark (LineParenthetical | Inline)+ Newline}

ForceTransition { ForceRight Newline }

ForceRight { GreaterThan (LineParenthetical | Inline)+ }

CenterLine { ForceRight LessThan Newline }

SceneNumber {SectionMark Numbers* SectionMark}


// --- Formatting Rules ---

ItalicBold { !p2 TripleAsterisks Inline+ TripleAsterisks}

Bold { !p2 DoubleAsterisks Inline+ DoubleAsterisks}

Italic { !p2 SingleAsterisk Inline+ SingleAsterisk}

Underline { !p2 Underscore Inline+ Underscore }

Note { !p2 NoteStart Inline+ NoteEnd}

Inline { !p2 Boneyard | Underline | ItalicBold | Bold | Italic | PlainText | Note | WhiteSpace }



// --- Tokens ---


@external tokens Fountain from "./tokenizer.js" {
  ForceActionMark,
  PageBreak,
  DualCharacter, 
  TitleKey,
  TitleValue
  Character,
  Transition,
  SynopsisMark,
  SceneHeading,
  GreaterThan,
  LessThan,
  BoneStart,
  BoneEnd,
  EmptyLine
}

@tokens {
  Newline { "\n" }
  Numbers { @digit }
  WhiteSpace { " "}
  LParen { "(" }
  RParen { ")" }
  NoteStart { "[[" }
  NoteEnd { "]]" }
  SectionMark {"#"}
  SingleAsterisk { "*" }
  DoubleAsterisks { "**" }
  TripleAsterisks { "***" }
  Underscore { "_"} 
  PlainText { ![()#<^*_\\/\]\[\n]+ }
  @precedence { GreaterThan LessThan NoteStart NoteEnd SectionMark LParen RParen BStart BEnd TripleAsterisks DoubleAsterisks SingleAsterisk Underscore WhiteSpace PlainText}
}

