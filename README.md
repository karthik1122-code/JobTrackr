# JobTrackr

A board to keep track of job applications as they move from Applied to Interview to Offer (or Rejected).

This is the Day 3 version: React UI only, everything lives in local state. A backend and more features come later in the week.

**Live:** https://jobtrackr-board.vercel.app

## Run it locally

```bash
npm install
npm run dev
```

## How it's put together

```
src/
├── App.jsx                     # holds all applications in one useState + the filters
├── constants.js                # statuses, priorities, next-stage map
├── validate.js                 # form rules (length, date, duplicates)
└── components/
    ├── Header.jsx              # title + "12 applications · 3 interviews · 1 offer"
    ├── ApplicationForm.jsx     # controlled form with errors under each field
    ├── Board.jsx               # renders one Column per status
    ├── Column.jsx              # count badge, cards, or "Nothing here yet"
    └── ApplicationCard.jsx     # move / reject / delete buttons
```

- State lives only in `App`. Data goes down as props, and changes come back up through `onAdd`, `onMove`, `onReject` and `onDelete`.
- Updates never mutate: `map` for moving and rejecting, `filter` for deleting, spread for adding.
- The filtered list and the header counts are calculated during render, not stored in state.
- Cards use `app.id` as the key.

## Rules

| Field | Rule |
| --- | --- |
| company, role | required, 2–60 characters |
| appliedOn | required, not in the future |
| priority | Low, Medium or High |
| duplicate | same company + role (ignoring case) is rejected |

Interview answers are in [INTERVIEW.md](INTERVIEW.md).
