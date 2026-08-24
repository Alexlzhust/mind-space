# Mind Space Auto Organize Design

## Goal

Add one-click automatic organization for active idea cards. The feature classifies cards into existing topics only, leaves uncertain cards in the unsorted zone, and arranges all topic zones around the centered unsorted zone.

The feature must remain deterministic, offline, private, and compatible with the project's single-HTML-file runtime.

## User Experience

- Add an `自动整理` button to the header toolbar.
- Clicking it immediately organizes all non-archived cards; there is no preview or confirmation step.
- The unsorted zone stays at the canvas center.
- Existing topic zones are reordered and placed in concentric rings around the unsorted zone.
- A short completion message reports how many cards were assigned and how many remain unsorted.
- One `Ctrl/Cmd+Z` operation restores all cards and topic positions to their exact pre-organize state.
- The operation never creates, renames, recolors, or deletes topics and never changes card text.

## Classification Rules

Classification uses only the current topic list and local card data. Each active card is scored independently against every topic.

Text normalization:

- Convert Latin text to lowercase.
- Normalize common punctuation and whitespace into token boundaries.
- Keep Chinese characters so topic names and Chinese keywords can match directly.

Scoring, from strongest to weakest:

1. An existing card tag exactly matching the topic name: 100 points.
2. The normalized card text containing the complete topic name: 40 points.
3. A token from the topic name appearing as a complete token in the card text: 10 points per distinct token.
4. Keywords learned from cards already assigned to that topic: 3 points per distinct keyword, capped so learned keywords cannot outweigh an exact topic-name match.

Learned keywords are derived only from active cards whose tags already include that topic name. Common stop words, one-character Latin tokens, punctuation, and the topic name itself are ignored. This allows existing manual organization to teach the classifier without adding configuration UI.

A card is assigned only when there is one unique highest-scoring topic and its score is at least 10. Ties, weak matches, and no matches remain unsorted. Existing topic tags are replaced by the selected topic name for organized cards; non-topic tags are preserved.

The algorithm is deterministic: the same ideas and topics always produce the same result.

## Zone Ordering And Layout

After classification, topics are sorted by:

1. Descending count of active cards assigned to the topic.
2. Original topic-list order as the stable tie-breaker.

The unsorted zone is placed at the existing canonical canvas-center position. Topic zones are arranged clockwise in concentric rings around it:

- The first ring contains up to 8 topics.
- Additional rings expand their radius and capacity based on circumference, keeping at least one zone width plus a fixed gap between neighboring zones.
- The first topic starts above the center and subsequent topics proceed clockwise.
- Zone coordinates are clamped to the canvas bounds.

After zones move, every active card is repositioned with the existing `findSpotInZone` behavior so cards fit within their assigned zone and do not keep stale coordinates from the previous layout. Archived cards are untouched.

## State And Undo

Before changing anything, the operation stores one deep snapshot containing:

- all active-card tags, status, and position;
- all topic positions;
- the current viewport transform.

The existing undo stack gains an `autoOrganize` action. Undo restores the entire snapshot, saves state, rerenders, and restores the previous viewport. The automatic operation itself creates exactly one undo entry regardless of card count.

After organization, the viewport fits all visible active cards and topic zones so the new radial arrangement is immediately understandable.

## Implementation Boundaries

The classifier and radial-layout calculations will be pure functions grouped in a clearly delimited block inside `index.html`. UI event handling, state mutation, persistence, undo integration, toast display, and viewport fitting remain in the existing application layer.

No API calls, model keys, network requests, build step, or runtime dependency will be introduced.

## Error And Edge Cases

- No topics: keep all active cards unsorted, center the unsorted zone, and report that there are no topics to organize into.
- No active cards: arrange existing topics and report zero cards organized.
- One topic: place it directly above the unsorted zone.
- Many topics: create additional rings without placing zones outside the canvas.
- Duplicate topic names are already prevented by existing topic management; classification assumes names are unique.
- Archived cards remain archived and retain their positions and tags.
- If browser storage fails, the in-memory organization still renders; persistence follows the app's existing failure behavior.

## Testing

Development will follow test-first implementation.

Automated tests will cover:

- exact existing-tag matches outrank text matches;
- full topic-name and token matches score correctly;
- learned keywords classify previously untagged cards;
- ties and scores below threshold remain unsorted;
- non-topic tags survive classification;
- archived cards are excluded;
- topic ordering uses card count and stable original order;
- one-topic, eight-topic, and multi-ring layouts remain centered, clockwise, separated, and within canvas bounds;
- one undo operation restores the complete pre-organize snapshot.

The pure organizer block will be loaded by a Node built-in test harness, so tests add no runtime dependency and the deployed app remains a single HTML file. Browser verification will also exercise the button, resulting layout, completion message, persistence, and undo flow at desktop and mobile viewport sizes.

## Acceptance Criteria

- A visible `自动整理` control organizes all active cards in one action.
- Cards are assigned only to existing topics using the documented deterministic scoring rules.
- Ambiguous and unmatched cards end in the centered unsorted zone.
- Topics are ordered by assigned-card count and arranged in rings around the unsorted zone.
- Cards are repositioned inside their final zones.
- Archived cards and card text are unchanged.
- One undo restores all affected cards, topics, and viewport state.
- The production site remains usable offline after load and requires no backend or API key.
