// What a card looks like, in one place. Two screens of one product must not
// disagree about a border, and they had started to.
//
// Neither string carries padding: the copilot is denser than a Mission Control
// section. Each use site adds its own.

// The ordinary card: hairline border, one-pixel shadow.
export const CARD =
  'bg-white rounded-2xl border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'

// The card you can talk to. A thicker blue border and a halo around it — the
// only place on either screen that answers when you type in it, and it says so
// before you read a word.
export const CARD_TALK =
  'bg-white rounded-2xl border-2 border-blue-400/60 ring-4 ring-blue-500/10 shadow-[0_2px_12px_rgba(59,130,246,0.10)]'
