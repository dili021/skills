# Lessons

A buffer of agent mistakes that may recur. An entry goes here before anyone fixes the cause. `/retro` reads this file, groups the entries, and proposes a check once one kind of mistake has three, or after one verifier miss.

What belongs: a mistake a person, a check or a verifier had to catch, and that another run could make again. Code in the wrong layer. A banned pattern. A test that asserts the implementation. A domain term misread. A question the code already answered. The same INCONCLUSIVE for the same reason. A verifier miss: a verdict passed and a person later found the bug. One verifier miss is enough for a check: a proof case in `verify/prove/` and a Gotchas line in the feature map.

What stays out: product bugs (those go to the issue tracker), one-off slips, product decisions.

| Date | What happened | Where | Caught by | Kind | Candidate check |
|------|---------------|-------|-----------|------|-----------------|
