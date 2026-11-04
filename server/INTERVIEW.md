# Interview corner (Day 6)

## Embedding vs referencing: how do you decide? Give an example of each.

I ask: does the child only make sense inside the parent, and is the list small? Then I embed it. If it's shared, used on its own or can grow without limit, I reference it. In JobTrackr, notes are embedded in an application because they're few and always read with it. The owner is referenced because a user has thousands of applications and changes their details on their own.

## Why do queries get slow, and how do indexes help? What is the cost of adding an index?

Without an index, MongoDB checks every document in the collection, a COLLSCAN. That gets slower as the data grows. An index is a sorted list of field values pointing to documents, so MongoDB jumps straight to the matches (IXSCAN). In my test that went from 1,000 documents examined to 87. The cost: every insert and update has to update the index too, and indexes take extra disk and memory.

## SQL vs NoSQL: when would you choose each for a new project?

I'd choose SQL when the data is very relational with lots of joins, needs strict transactions like payments, or has a fixed schema I want the database to enforce. I'd choose NoSQL like MongoDB when each record is a self-contained document, the shape is still changing, or I need to scale reads and writes easily. JobTrackr fits MongoDB because an application and its notes live together in one document.
