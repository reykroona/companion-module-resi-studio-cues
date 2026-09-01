# Resi Studio Cues (Bitfocus Companion Module)

This module logs into **studio.resi.io / central.resi.io** with a username and password, tracks Resi encoder events, and creates and reads shared cue points. Encoder cues are available to decoder operators at other campuses and can also be viewed in the Resi website, so everyone can see when the marked events occur.

The module can drive workflows such as a **countdown clock in ProPresenter** while keeping cue timing tied to the shared Resi event.

---

## Features

### Authentication
- Logs in via `POST /api/v3/login?newToken=true`
- Stores auth cookies (`refreshToken`, `livingas1`) and uses them on subsequent requests
- Exposes status via:
  - Instance status (green/red in Companion)
  - Variables: `auth_status`, `last_error`

### Player polling (live)
- Polls decoder/player position from:
  - `GET /api_v2.svc/users/{venueUuid}/players`
- Updates variables like:
  - `current_position`
  - `current_position_sec`
  - `current_event_id`

### Encoder event tracking
- Loads the account's events and presents the available encoders and events in action menus.
- An encoder can be selected manually or configured as the default encoder at startup.
- While the selected encoder is started, the module finds the event whose `startTime` and `stopAfter` contain the current time and loads its cues automatically.
- The selected event exposes elapsed stream variables, including `stream_elapsed`, `stream_elapsed_hm`, `stream_elapsed_ms`, and `stream_elapsed_ss`.
- The encoder position includes a four-second offset to account for encoder latency.

### Cue loading (per event)
When the current `eventId` changes, the module loads:
- Event detail:
  - `GET /api/v3/customers/{customerId}/events/{eventId}`
  - Captures `startTime` for ToD (time-of-day) math
- Cues:
  - `GET /api_v2.svc/streamprofiles/{eventProfileId}/events/{eventId}/cues?canISetCues=1`

Cues are stored locally and used to compute **next/prev** cue timing from the live playback position.

### Cue timing variables
- Next cue:
  - `next_cue_name`
  - `next_cue_time_in_seconds`
  - `next_cue_time_in_hms`
  - `next_cue_position`
  - `next_cue_tod` (24-hour)
- Previous cue:
  - `prev_cue_name`
  - `prev_cue_time_ago_in_seconds`
  - `prev_cue_time_ago_in_hms`
  - `prev_cue_position`
  - `prev_cue_tod` (24-hour)

### Cue management actions
- Add cue (current event position, player position, or custom time)
- Lookup cue by name (stores into `lookup_*` variables)
- Delete cue by name (looks up UUID, deletes by UUID)

When the player position is unavailable, the player-position cue action falls back to the selected event's calculated position.

Cues created by the module are written to the selected Resi event. They are not local Companion markers, so decoder operators and other Resi users can use the same cues wherever that event is available.

---

## Installation / Testing

### Best (recommended): Developer Module via Git
1. Push this repo to GitHub/GitLab (public or private).
2. On the test system, add it as a Developer Module in Companion.
3. Restart Companion.

### Offline / manual
1. `yarn install`
2. `yarn build`
3. Zip the module folder (without `node_modules`) and provide to tester.
4. Tester places it in Companion’s modules folder and restarts Companion.

(Exact folder paths vary by OS / Companion version.)

---

## Configuration

Typical config fields:
- **Username / Email**
- **Password** (secret)
- **Default encoder** (optional)
- **Default Player** (optional)
- **Polling intervals**
  - Playback position refresh (fast, e.g. 2000ms)
  - Account/venue refresh (slow, e.g. 60000ms)
  - Cue refresh while playing (optional, e.g. 15000ms)
- **Fallback when no next cue** (optional)

> Note: dynamic "read-only" status display inside config is not supported by Companion config fields.
> Use Instance Status + module variables for connection state.

---

## Actions

- **Refresh profile**: Reload `/users/me`
- **Refresh lists**: Reload venues + players list
- **Select decoder/player**: Choose which player to poll
- **Add cue at player position (or custom time)**
  - Options:
    - Cue name
    - Private cue
    - Position source: player vs custom
    - Custom time string
  - Text fields support Companion variables (e.g. `$(internal:...)`)
- **Lookup cue by name**
  - Writes result into:
    - `lookup_cue_found`, `lookup_cue_uuid`, `lookup_cue_position`, etc.
- **Delete cue by name**
  - Finds matching cue(s), deletes by UUID via:
    - `DELETE /.../cues/{uuid}`

---

## Feedbacks (for button coloring)

Recommended “production” feedback set:
1. **Connected (auth OK)** → Green
2. **Error (auth/API)** → Red
3. **Player active** (position > 0) → Blue
4. **Approaching next cue** (threshold seconds) → Yellow
5. **Playback frozen** (position not changing) → Red

Playback frozen requires:
- variable `playback_last_change_epoch_ms` to be updated when playback position changes.

---

## Presets Included

### Status
- Connected / Error indicator
- Player active indicator
- Playback frozen warning

### Cues
- Next cue display (with T- countdown)
- Previous cue display

### Encoder and event selection
- Select a Resi event
- Select an encoder and follow its active event

### Maintenance
- Refresh profile
- Refresh venues/players list

### Cue actions
- Add cue @ player position
- Add cue @ custom time
- Lookup cue by name
- Delete cue by name

---

## Notes / Limitations

- The Resi API endpoints used here are not public/stable; breaking changes may occur.
- Avoid polling cues every 2 seconds. Recommended cue refresh while playing is 10–30 seconds unless you have a specific need.
- Companion config fields are not truly read-only, so status is exposed via variables + instance status.
- Encoder event detection polls every 10 seconds while an encoder is selected.
- Encoder event detection requires both `startTime` and `stopAfter` on the Resi event. Events without a complete time window are not selected automatically.

---
