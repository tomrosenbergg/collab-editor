// src/parser/tokenizer.js

import { ExternalTokenizer } from '@lezer/lr';
import {
  PageBreak,
  TitleKey,
  TitleValue,
  Character,
  Transition,
  SynopsisMark,
  SceneHeading,
  GreaterThan,
  LessThan,
  BoneStart,
  BoneEnd,
  EmptyLine,
  DualCharacter,
  ForceActionMark, // This will be generated in the next step
} from './fountain-parser.terms.js';

// Character code constants (no changes here)
const newline = 10,
  space = 32,
  tab = 9,
  asterisk = 42,
  slash = 47,
  colon = 58,
  lParen = 40,
  rParen = 41,
  equals = 61,
  greaterThan = 62,
  lessThan = 60,
  at = 64,
  a = 97,
  z = 122,
  T = 84,
  O = 79,
  bang = 33,
  A = 65, // ADDED: Character code for 'A'
  Z = 90; // ADDED: Character code for 'Z'

class FountainTokenizer {
  constructor() {
    this.inBoneyard = false;
  }

  token(input, stack) {
    const start = input.pos;

    // --- Boneyard, TitleValue, LessThan, Start-of-line checks ---
    // (This top section of the code is unchanged)
    if (input.peek(0) === slash && input.peek(1) === asterisk) {
      if (!this.inBoneyard) {
        this.inBoneyard = true;
        input.advance(2);
        input.acceptToken(BoneStart);
        return;
      }
    }
    if (input.peek(0) === asterisk && input.peek(1) === slash) {
      if (this.inBoneyard) {
        this.inBoneyard = false;
        input.advance(2);
        input.acceptToken(BoneEnd);
        return;
      }
    }
    if (stack.canShift(TitleValue)) {
      let endPos = 0;
      while (input.peek(endPos) !== newline && input.peek(endPos) !== -1) {
        endPos++;
      }
      let lookahead = endPos;
      while (true) {
        if (input.peek(lookahead) === -1 || input.peek(lookahead) !== newline)
          break;
        let nextLineStart = lookahead + 1;
        const isTabIndented = input.peek(nextLineStart) === tab;
        const isSpaceIndented =
          input.peek(nextLineStart) === space &&
          input.peek(nextLineStart + 1) === space;
        if (isTabIndented || isSpaceIndented) {
          let nextLineEnd = nextLineStart;
          while (
            input.peek(nextLineEnd) !== newline &&
            input.peek(nextLineEnd) !== -1
          ) {
            nextLineEnd++;
          }
          endPos = nextLineEnd;
          lookahead = nextLineEnd;
        } else {
          break;
        }
      }
      input.advance(endPos);
      input.acceptToken(TitleValue);
      return;
    }
    if (input.peek(0) === lessThan) {
      let pos = 1;
      while (input.peek(pos) === space) pos++;
      const nextChar = input.peek(pos);
      if (nextChar === newline || nextChar === -1) {
        input.advance(1);
        input.acceptToken(LessThan);
        return;
      }
    }
    const isStartOfLine = start === 0 || input.peek(-1) === newline;
    if (!isStartOfLine) {
      return;
    }
    let scanPos = 0;
    while (true) {
      const char = input.peek(scanPos);
      if (char === space || char === tab) {
        scanPos++;
        continue;
      }
      if (char === newline) {
        input.advance(scanPos + 1);
        input.acceptToken(EmptyLine);
        return;
      }
      break;
    }
    if (input.peek(0) === greaterThan) {
      input.advance(1);
      input.acceptToken(GreaterThan);
      return;
    }
    if (input.peek(0) === equals && input.peek(1) !== equals) {
      input.advance(1);
      input.acceptToken(SynopsisMark);
      return;
    }
    if (
      input.peek(0) === equals &&
      input.peek(1) === equals &&
      input.peek(2) === equals
    ) {
      const nextChar = input.peek(3);
      if (nextChar === newline || nextChar === -1) {
        input.advance(3);
        input.acceptToken(PageBreak);
        return;
      }
    }
    let titleLineEndPos = start;
    let colonPos = -1;
    let hasContentBeforeColon = false;
    while (true) {
      const char = input.peek(titleLineEndPos - start);
      if (char === -1 || char === newline) break;
      if (char === colon) colonPos = titleLineEndPos;
      if (char !== space && colonPos === -1) hasContentBeforeColon = true;
      titleLineEndPos++;
    }
    if (colonPos !== -1 && hasContentBeforeColon && stack.canShift(TitleKey)) {
      input.advance(colonPos - start + 1);
      input.acceptToken(TitleKey);
      return;
    }
    const prefixes = ['INT./EXT.', 'INT/EXT.', 'INT.', 'EXT.', 'I/E.'];
    let buffer = '';
    for (let i = 0; i < 10; i++) {
      const char = input.peek(i);
      if (char === -1) break;
      buffer += String.fromCharCode(char);
    }
    for (const prefix of prefixes) {
      if (buffer.startsWith(prefix)) {
        input.advance(prefix.length);
        input.acceptToken(SceneHeading);
        return;
      }
    }
    if (input.peek(0) === 46 /* . */) {
      const nextChar = input.peek(1);
      if (
        nextChar !== 46 &&
        nextChar !== newline &&
        nextChar !== -1 &&
        nextChar !== space
      ) {
        input.advance(1);
        input.acceptToken(SceneHeading);
        return;
      }
    }

    // --- [REFACTORED] CHARACTER & TRANSITION LOGIC ---

    // MODIFIED: This is the new, more explicit implementation for the '!' rule.
    if (input.peek(0) === bang) {
      // This is a Forced Action Line. We consume the '!' as its own token
      // and let the grammar parse the rest of the line as the content.
      input.advance(1);
      input.acceptToken(ForceActionMark);
      return;
    }

    // Helper functions remain the same
    const isPrecededByBlankLine = () => {
      if (start === 0) return true;
      let prev = input.peek(-2);
      if (prev === 13) prev = input.peek(-3);
      return prev === newline;
    };
    const isFollowedByNonBlankLine = (endPos) => {
      let pos = endPos;
      if (input.peek(pos - start) === 13) pos++;
      if (input.peek(pos - start) === newline) pos++;
      while (input.peek(pos - start) === space) pos++;
      const nextChar = input.peek(pos - start);
      return nextChar !== newline && nextChar !== -1;
    };

    // The initial line scan remains the same
    let scanEndPos = start;
    let hasLowercase = false;
    let contentEndPos = start;
    let parenPos = -1;
    let lineLastChar = -1;
    let lineHasContent = false;
    while (true) {
      const char = input.peek(scanEndPos - start);
      if (char === -1 || char === newline) break;
      if (char >= a && char <= z) hasLowercase = true;
      if (char !== space) {
        contentEndPos = scanEndPos + 1;
        lineLastChar = char;
        lineHasContent = true;
      }
      if (char === lParen && parenPos === -1) parenPos = scanEndPos;
      scanEndPos++;
    }

    if (!lineHasContent) return;

    // The dual dialogue caret check remains the same
    let isDualDialogue = false;
    if (input.peek(contentEndPos - start - 1) === 94 /* ^ */) {
      isDualDialogue = true;
      contentEndPos--;
      while (
        contentEndPos > start &&
        input.peek(contentEndPos - start - 1) === space
      ) {
        contentEndPos--;
      }
      lineLastChar = input.peek(contentEndPos - start - 1);
    }

    // --- NEW LOGIC ORDER ---

    // Condition 1: Check for Forced Character (@) first, as it's the most specific override.
    if (input.peek(0) === at) {
      if (isPrecededByBlankLine() && isFollowedByNonBlankLine(scanEndPos)) {
        let characterNameEndPos = parenPos !== -1 ? parenPos : contentEndPos;
        while (
          characterNameEndPos > start &&
          input.peek(characterNameEndPos - start - 1) === space
        ) {
          characterNameEndPos--;
        }
        // A forced character cannot be a dual character.
        input.advance(characterNameEndPos - start);
        input.acceptToken(Character);
        return;
      }
    }

    // If the line has any lowercase letters, it can't be a Character or Transition, so we can exit.
    if (hasLowercase) {
      return;
    }

    // Condition 2: Check for a Transition.
    if (
      scanEndPos - start > 3 &&
      input.peek(contentEndPos - start - 3) === T &&
      input.peek(contentEndPos - start - 2) === O &&
      input.peek(contentEndPos - start - 1) === colon
    ) {
      input.advance(scanEndPos - start);
      input.acceptToken(Transition);
      return;
    }

    // MODIFIED: Condition 3: Handle Regular and Dual Characters with the new, more specific rule.
    const firstChar = input.peek(0);
    const secondChar = input.peek(1);
    const startsWithTwoCaps =
      firstChar >= A && firstChar <= Z && secondChar >= A && secondChar <= Z;

    if (
      startsWithTwoCaps &&
      isPrecededByBlankLine() &&
      isFollowedByNonBlankLine(scanEndPos)
    ) {
      const extensionIsValid =
        parenPos === -1 || (parenPos !== -1 && lineLastChar === rParen);

      if (extensionIsValid) {
        let characterNameEndPos = parenPos !== -1 ? parenPos : contentEndPos;
        while (
          characterNameEndPos > start &&
          input.peek(characterNameEndPos - start - 1) === space
        ) {
          characterNameEndPos--;
        }

        if (isDualDialogue) {
          input.advance(characterNameEndPos - start);
          input.acceptToken(DualCharacter);
        } else {
          input.advance(characterNameEndPos - start);
          input.acceptToken(Character);
        }
        return;
      }
    }
  }
}

const tokenizer = new FountainTokenizer();
export const Fountain = new ExternalTokenizer(tokenizer.token.bind(tokenizer));
