# Recommendation Affinity Design

## Goal

Improve recommendations in [`app/api/recommendations/route.ts`](/Users/ma/repo/bookAdvisor/app/api/recommendations/route.ts) so the system stops over-pushing books from the same author while still preserving a useful amount of familiarity. The new behavior should produce a mix of familiar and discovery-oriented recommendations.

## Current Problem

The current implementation derives `likedAuthors` only from positively rated books and then uses those authors twice:

- to seed recommendation candidates
- to apply a full exact-match author score during ranking

That creates a reinforcing loop where one positively rated author can dominate the results even when the user has mixed or negative history with that author.

## Approved Direction

Use net author affinity based on all user annotations, including negative ratings and dropped books, then apply that author signal as a soft ranking factor instead of a dominant one.

This design keeps authors relevant while making genre, performer, popularity, and diversity matter more.

## Requirements

- Author preference must consider all reviews for that author, not only positive ratings.
- Negative ratings must reduce author affinity.
- Dropped books must reduce author affinity.
- If `readStatus=dropped` and no rating is set, count that interaction as `-2`.
- If `readStatus=dropped` and a rating is set, use the rating-derived sentiment instead of forcing `-2`.
- Mixed-sentiment authors must remain eligible for a small positive author boost.
- Recommendations should aim for a mix of familiar authors and discovery.
- Download count must remain a ranking factor, but only a modest one.
- Download count should matter slightly more when the user has thin history.
- API response shape should remain stable for the existing recommendations page.
- Existing exclusion rules for annotated books must continue to hold.

## Data Model Changes

Extend the internal preference model built in the recommendations route.

Current preference data:

- liked genres
- liked authors
- liked performers
- high-performance performers
- average ratings

New author affinity data:

- `authorAffinity`: map of normalized author affinity score
- `authorStats`: per-author interaction stats
  - `interactionCount`
  - `netSentiment`
  - `avgSentiment`
  - `dropCount`

These fields are internal to the route and do not need to be exposed to the UI in the first iteration.

## Sentiment Mapping

Each annotation contributes a sentiment value.

Proposed mapping:

- rating `5` -> `+2`
- rating `4` -> `+1`
- rating `3` -> `0`
- rating `2` -> `-1`
- rating `1` -> `-2`
- `readStatus=dropped` with no rating -> `-2`

Rules:

- If a rating exists, derive sentiment from the rating.
- If no rating exists and `readStatus=dropped`, use `-2`.
- Non-dropped unrated annotations do not contribute to author sentiment.

This keeps the author model centered on explicit user feedback while still treating an unrated drop as a clear negative signal.

## Preference Extraction

Refactor preference extraction so author learning is no longer based only on positive ratings.

Behavior:

- Keep genre and performer preference extraction mostly aligned with positive feedback.
- Build author affinity from all relevant annotations.
- Aggregate author stats across all annotated books for the user.
- Ignore books with missing or unknown authors.
- Normalize author affinity so a single interaction does not overpower the result list.

Normalization target:

- strongly positive authors receive a modest boost
- mixed authors receive a very small boost
- clearly negative authors receive no boost or a small penalty

## Scoring Changes

Replace the current binary exact-match author scoring with soft author affinity scoring.

Current issue:

- author match is effectively binary
- exact author matches can contribute too much to final score

New behavior:

- reduce author weight from `0.20` to approximately `0.08` to `0.12`
- map each book's author to the user's computed affinity band
- apply a modest positive score for strongly positive authors
- apply a small positive score for mixed authors
- apply zero or a small negative score for clearly negative authors
- keep downloads as a low-weight popularity signal so broadly validated books can rise slightly
- when the user has thin history, allow downloads to matter a bit more than in a mature profile

The recommendation weights after this change should continue to favor shared genre and other metadata over exact author repetition.

## Candidate Selection Changes

The candidate set should stop being overly seeded by familiar authors.

Recommended candidate strategy:

- continue excluding all annotated books
- seed candidates primarily from genre and performer matches
- include only a limited slice of author-based candidate matches
- exclude strongly negative authors from author-based seeding
- backfill with popular books to maintain enough candidate volume

This changes author from a dominant retrieval axis into a secondary retrieval axis.

## Final Diversity Pass

Apply a post-ranking author diversity pass before returning results.

Behavior:

- rank books by total score as usual
- scan the sorted list and cap repeated authors in the final response
- if an author exceeds the cap, skip lower-ranked books from that author and pull the next best different-author candidate

Recommended default:

- maximum `2` books per author in a result set of `20`

This is intentionally light-touch. It does not ban repeated authors; it only prevents one author from flooding the page.

## Fallback Behavior

Users with no meaningful positive preference history should still receive useful recommendations.

Behavior:

- if there is no usable preference history, continue using popular fallback excluding annotated books
- once annotation history exists, include negative author sentiment in the model even if positive signals are sparse
- when history is thin, popularity from downloads and genre should carry more of the ranking than author affinity

## API Compatibility

Keep the response contract stable for [`app/recommendations/page.tsx`](/Users/ma/repo/bookAdvisor/app/recommendations/page.tsx):

- continue returning `recommendations`
- continue returning `preferences`
- continue returning `reason`

Implementation details can change behind the API boundary without requiring a matching UI rewrite.

## Testing Plan

Update or add tests in [`app/api/__tests__/recommendations.test.ts`](/Users/ma/repo/bookAdvisor/app/api/__tests__/recommendations.test.ts).

Required coverage:

- author affinity uses both positive and negative ratings
- an unrated dropped book contributes `-2` author sentiment
- a rated dropped book uses rating-derived sentiment instead of forced `-2`
- mixed-feedback authors receive only a small boost
- downloads contribute a small ranking boost without dominating the list
- downloads matter slightly more when the user profile is thin
- strongly negative authors do not dominate candidate selection
- final recommendations are diversified so one author cannot fill the list
- existing annotated-book exclusion behavior still passes

## Implementation Notes

The route is currently doing several jobs at once:

- extracting preferences
- generating candidates
- scoring books
- returning serialized results

As part of this work, the file should be made easier to reason about by isolating:

- sentiment calculation
- author affinity aggregation
- candidate retrieval
- diversity filtering

This refactor should stay scoped to the recommendations feature and avoid unrelated cleanup.

## Non-Goals

- re-enabling vector search in this iteration
- changing the frontend recommendations UI
- changing book or annotation database schema
- introducing personalized embeddings or external recommendation infrastructure

## Rollout Expectation

Expected user-visible outcome:

- fewer recommendation lists dominated by one author
- mixed authors still appear sometimes
- disliked or repeatedly dropped authors appear less often
- more-downloaded books get a mild advantage, especially for sparse profiles
- recommendations feel broader without becoming random
