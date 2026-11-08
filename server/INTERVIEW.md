# Interview corner (Day 6)

## Embedding vs referencing: how do you decide? Give an example of each.

I ask: does the child only make sense inside the parent, and is the list small? Then I embed it. If it's shared, used on its own or can grow without limit, I reference it. In JobTrackr, notes are embedded in an application because they're few and always read with it. The owner is referenced because a user has thousands of applications and changes their details on their own.

## Why do queries get slow, and how do indexes help? What is the cost of adding an index?

Without an index, MongoDB checks every document in the collection, a COLLSCAN. That gets slower as the data grows. An index is a sorted list of field values pointing to documents, so MongoDB jumps straight to the matches (IXSCAN). In my test that went from 1,000 documents examined to 87. The cost: every insert and update has to update the index too, and indexes take extra disk and memory.

## SQL vs NoSQL: when would you choose each for a new project?

I'd choose SQL when the data is very relational with lots of joins, needs strict transactions like payments, or has a fixed schema I want the database to enforce. I'd choose NoSQL like MongoDB when each record is a self-contained document, the shape is still changing, or I need to scale reads and writes easily. JobTrackr fits MongoDB because an application and its notes live together in one document.

# Interview corner (Day 7)

## Authentication vs authorisation, with an example from JobTrackr.

Authentication is proving who you are. Authorisation is what you're allowed to do once we know. In JobTrackr, logging in with email and password and getting a JWT is authentication, and the `protect` middleware checks that token. Authorisation is `authorize('admin')` giving normal users a 403 on the admin stats route, and every query filtering by `owner` so User B can't see User A's applications.

## JWT vs sessions with cookies: what are the trade-offs? Where should a frontend store the token, and why?

With sessions, the server stores who's logged in and the browser just holds a session id cookie. That's easy to revoke, but every request needs a lookup. A JWT carries the user id itself, so the server stays stateless and it scales easily, but it can't be cancelled before it expires. I'd store it in an httpOnly, secure, SameSite cookie. JavaScript can't read it there, so an XSS attack can't steal it, unlike localStorage.

## What are XSS and CSRF, and how do you defend against each?

XSS is when an attacker gets their script to run on your site, e.g. through a note containing HTML. Defend by escaping output (React does this), never using dangerouslySetInnerHTML with user input, and adding a Content-Security-Policy. CSRF is when another site makes your logged-in browser send a request using your cookies. Defend with SameSite cookies, CSRF tokens, or sending the token in an Authorization header instead of a cookie.

---

# Day 10: LLMs

## What is a token, a context window and a knowledge cutoff? Why do LLMs hallucinate, and how do you reduce it?

A token is a chunk of text the model reads, roughly ¾ of a word. The context window is how many tokens fit in one request, input and output together. The knowledge cutoff is the date its training data ends. Models hallucinate because they predict likely next words, not true ones. I reduce it by giving the facts in the prompt, telling it to return null when something isn't there, using JSON output, and checking the answer in code.

## What does temperature control? When would you use 0?

Temperature controls how random the next-token choice is. At 0 it almost always picks the most likely token, so the same input gives nearly the same output. At 1 it picks less likely words more often, so answers vary more. I use 0 for anything that must be consistent or parsed by code, like extract and summarize. A little higher, like 0.3, suits rewriting, where some variety helps.

## How do you choose a model for a feature, and how do you control cost?

Start with the cheapest, fastest model and only move up if the answers aren't good enough on real examples. Summarising and extracting from short text don't need a big model, so I use Flash-Lite. To control cost: cap input at 6,000 characters, limit output tokens, rate-limit each user, log tokens and cost for every call, keep prompts short, and set a spending limit with the provider.
