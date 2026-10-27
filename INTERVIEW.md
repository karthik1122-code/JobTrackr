# Interview corner

## What is the virtual DOM, and what does reconciliation do?

The virtual DOM is a plain JavaScript copy of what the UI should look like. Changing the real DOM is slow, so React doesn't touch it directly. When state changes, React builds a new virtual tree and compares it with the old one. That comparison is reconciliation. React works out the smallest set of changes, like "update this text" or "remove this card", and only applies those to the real DOM.

## Why do lists need keys, and what goes wrong with the index as a key? What does JSX compile to?

Keys tell React which item is which between renders, so it can match old and new items instead of guessing. With the index, deleting or reordering shifts every index, so React mixes up which item is which and state can end up on the wrong card. I use each application's id.

JSX compiles to function calls. `<Card title="x" />` becomes `jsx(Card, { title: "x" })`, which returns a plain object describing the element.

## Why must state be treated as immutable in React?

React decides whether to re-render by checking if the new state is a different object from the old one. If I push into the same array or change an object directly, the reference stays the same, so React thinks nothing changed and skips the update. Making a new array with map, filter or spread gives React a new reference. It also keeps the old state untouched, which makes bugs easier to track down.
