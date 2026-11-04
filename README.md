# JobTrackr

A board to keep track of job applications as they move from Applied to Interview to Offer (or Rejected).

- **Frontend** (this folder): React + Vite. Day 3 built the board, Day 8 connected it to the API with login, protected pages and live CRUD.
- **Backend** ([`server/`](server/), Days 5–7): Express REST API with MongoDB, JWT login and security defences. See [server/README.md](server/README.md).

## Run it locally

You need the API running first (see [server/README.md](server/README.md): Atlas URI, `npm run seed`, `npm run dev`).

```bash
# in the project root (frontend)
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm run dev               # http://localhost:5173
```

The API's `CLIENT_URL` in `server/.env` must be `http://localhost:5173`, or the browser blocks every request (see [CORS](#cors) below).

Log in with a seeded account (`karthik@example.com` / `Password123!`, 500 applications) or register a new one.

## How it's put together

```
src/
├── api/                        # the ONLY place that talks to the server
│   ├── client.js               # Axios instance, interceptors, readError()
│   ├── auth.js                 # registerUser, loginUser, fetchMe
│   └── applications.js         # fetchApplications, fetchStats, create, update, delete
├── context/AuthContext.jsx     # user, token, login, register, logout
├── components/
│   ├── ProtectedRoute.jsx      # not logged in → /login (remembers where you were going)
│   ├── Header.jsx              # "500 applications · 101 interviews · 24 offers" + log out
│   ├── StatsBar.jsx            # counts per status + average offer stipend (Day 6 aggregation)
│   ├── ApplicationForm.jsx     # shows the API's field errors under each input
│   ├── Board.jsx / Column.jsx / ApplicationCard.jsx
│   └── Pagination.jsx
├── pages/
│   ├── BoardPage.jsx           # loads data, filters in the URL, optimistic moves
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   └── NotFound.jsx
├── hooks/useDebounce.js
├── constants.js
└── validate.js                 # quick checks before sending (the API checks again)
```

## Axios client and interceptors

`src/api/client.js` creates one Axios instance with `baseURL: import.meta.env.VITE_API_URL`. Components never import Axios. They call functions like `fetchApplications()` from `src/api/`.

- **Request interceptor**: if there's a token, it adds `Authorization: Bearer <token>` to every request.
- **Response interceptor**: if any request comes back **401** while we have a token, the session is no longer valid (expired, or the account was deleted). It calls the handler from `AuthContext`, which clears the token and the user and sends you to `/login` with **"Your session has expired. Please log in again."** After you log in again you land back on the same page, filters included.
  - A 401 from the login form itself (wrong password) is skipped, so it just shows "Invalid email or password".
- `readError(err)` turns any Axios error into `{ message, errors }`. Field errors from the API (like `{ salary: "salary can't be negative" }` or a 409 `{ role: "You already added..." }`) appear under the matching input. If the server can't be reached at all, it shows "Can't reach the server".

## Auth and protected routes

- `AuthContext` holds `user`, `token`, `login`, `register` and `logout`.
- **On page load**, if a token is saved, it calls `GET /api/auth/me` **before showing any page** (you see "Loading JobTrackr…" for a moment). Valid token → you're logged in, so the session survives a refresh. Expired token → login page with the expired message.
- `ProtectedRoute` wraps the board. Logged-out visitors are sent to `/login` with the page they wanted (path + query) saved in router state. After logging in or registering, they're sent back there. For example, opening `/?status=Interview&search=goo` while logged out brings you back to exactly that after login.
- **Logout** removes the token and the user. The board's data lives in `BoardPage` state, so it's thrown away when the page unmounts, and nothing from the old account stays in memory.
- The token is kept in `localStorage` so the session survives a refresh. The safer option is an httpOnly cookie, because JavaScript can't read it, so XSS can't steal it. That needs the API to set the cookie and handle CSRF, so it's a good next step. React already escapes user content (see the XSS section in the server README), which lowers the risk for now.

## Board connected to the API

Every action calls the API and the result is saved in MongoDB. While a request runs, that card's buttons (or the form's submit button) are disabled and the card is dimmed.

### When I refetch vs when I update state myself

| Action | What happens | Why |
| --- | --- | --- |
| **Move / Reject** | **Optimistic.** The card moves on screen immediately, then `PATCH` is sent. On success the card is replaced with the server's version. On failure it's moved back and a red banner explains why (e.g. "Couldn't move Zerodha to Interview: Server is having a bad day"). | It's the action people do most, and the result is fully predictable: only one field of one card changes. Waiting for the network would make the board feel slow. |
| **Add** | **Wait, then refetch** the current page (or jump to page 1). | The server decides the `_id`, the timestamps and where the card falls in the newest-first order, and the total and page count change. Guessing all that locally is error-prone. |
| **Delete** | **Wait, then refetch.** | It can't be undone, so the user should only see it gone once it really is. Refetching also pulls a card up from the next page so the page stays full. If the last card on a page is deleted, it steps back a page. |
| **Stats** | **Refetched** after every successful add, move, reject or delete. | The counts come from an aggregation over *all* applications, not just the ones on screen, so only the server knows the new numbers. |

When a status filter is on and a card moves to another status, the list is also refetched, because the card no longer belongs on that list.

## Search, filters, pagination and stats

- The search box, status filter and page number are stored in the URL with `useSearchParams`, e.g. `/?search=google&status=Interview&page=2`. A refresh, the back button or a shared link keeps them.
- They're sent to the API as query params (`GET /api/applications?page=2&limit=20&search=google&status=Interview`), so **filtering and paging happen in MongoDB**, not in the browser.
- The search box waits 400 ms after you stop typing before updating the URL, so typing a word sends one request, not one per letter. Changing the search or the status goes back to page 1.
- Each load uses an `AbortController`, so if you change filters quickly, the old request is cancelled and can't overwrite the newer result.
- **Pagination**: 20 per page, with Previous / Next and "Page 2 of 25 (500 total)".
- **Stats bar**: Applied / Interview / Offer / Rejected counts and the average offer stipend, from `GET /api/applications/stats`. The header line uses the same numbers.
- States: loading, an error with **Try again**, "No applications yet" for a new account, "No applications match these filters" with **Clear filters**, and "Nothing here yet" in empty columns.

## CORS

The first CORS error I hit was from running the frontend on a different port than the API allows (Vite picked `5174` because `5173` was busy). Chrome's console showed:

```
Access to XMLHttpRequest at 'http://localhost:5000/api/auth/login' from origin 'http://localhost:5174'
has been blocked by CORS policy: Response to preflight request doesn't pass access control check:
The 'Access-Control-Allow-Origin' header has a value 'http://localhost:5173' that is not equal to the
supplied origin.
```

What it means:
- The frontend (`localhost:5174`) and the API (`localhost:5000`) are **different origins** (a different port counts), so the browser applies the same-origin policy.
- Because the request sends `Content-Type: application/json` and an `Authorization` header, the browser first sends a **preflight** `OPTIONS` request to ask the API whether this origin may call it.
- The API's `cors({ origin: process.env.CLIENT_URL })` answered `Access-Control-Allow-Origin: http://localhost:5173`. That doesn't match `5174`, so **the browser** blocked the real request. Axios only sees a network error, so the UI showed "Can't reach the server".
- The API itself was fine. Postman and curl work because CORS is only enforced by browsers.

**Fix**: run the frontend on the allowed origin (`npm run dev` uses 5173), or set `CLIENT_URL` in `server/.env` to the origin the frontend actually runs on. When deploying, set `CLIENT_URL` to the deployed frontend URL. Never use `origin: '*'` with credentials.

## Network tab

Screenshots from Chrome DevTools → Network (filter: Fetch/XHR):

| Response | How to get it | Screenshot |
| --- | --- | --- |
| **200** | Log in and load the board → `applications?page=1&limit=20` | ![200](screenshots/network-200.png) |
| **401** | Log in with a wrong password → `login` returns `Invalid email or password` | ![401](screenshots/network-401.png) |
| **400** | Add an application with a stipend of `-500` → `applications` (POST) returns `{ "errors": { "salary": "salary can't be negative" } }`, shown under the field | ![400](screenshots/network-400.png) |

The stipend field is checked only by the API, so this 400 can be shown. Every other field is also checked in the form before sending.

## Day 3: board basics

The original Day 3 work is still the base of the board: separate `Board`, `Column` and `ApplicationCard` components, `_id` as the key (never the index), and state updated immutably with `map`, `filter` and spread. `apps.push(x); setApps(apps)` wouldn't re-render, because the array reference stays the same and React compares state with `Object.is`.

Interview answers for Day 3 are in [INTERVIEW.md](INTERVIEW.md).
