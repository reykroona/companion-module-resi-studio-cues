import { InstanceBase, InstanceStatus } from '@companion-module/base';
import { GetConfigFields } from './config.js';
import { UpdateVariableDefinitions } from './variables.js';
import { UpdateActions } from './actions.js';
import { UpdateFeedbacks } from './feedbacks.js';
import { UpdatePresets } from './presets.js';
export class ModuleInstance extends InstanceBase {
    config;
    secrets;
    cookieHeader = '';
    refreshToken;
    livingas1;
    pollTimer;
    pollInFlight = false;
    lastLoginMs = 0;
    loginInFlight;
    customerId;
    venues = [];
    events = [];
    playersByVenueUuid = {};
    selectedEncoderId;
    encoderChoices = [];
    encoderEventPollTimer;
    encoderEventPollInFlight = false;
    streamElapsedTimer;
    encoderPositionOffsetMs = 4000; // 4 seconds offset to account for encoder latency
    cues = [];
    selectedVenueUuid;
    selectedPlayerHardwareId;
    playerPollTimer;
    playerPollInFlight = false;
    currentEventId;
    currentEventProfileId;
    eventMediaStartEpochMs;
    lastPlayerPosition;
    lastCueRefreshMs = 0;
    cueRefreshInFlight = false;
    lastPositionSec;
    getCurrentEncoderPositionMs() {
        if (!this.eventMediaStartEpochMs)
            return undefined;
        const elapsedMs = Date.now() -
            this.eventMediaStartEpochMs -
            this.encoderPositionOffsetMs;
        return elapsedMs >= 0 ? elapsedMs : undefined;
    }
    constructor(internal) {
        super(internal);
    }
    updateStreamElapsed() {
        const positionMs = this.getCurrentEncoderPositionMs();
        if (positionMs === undefined) {
            this.setVariableValues({
                stream_elapsed: '',
                stream_elapsed_ss: '',
            });
            return;
        }
        const totalSeconds = Math.floor(positionMs / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const seconds = totalSeconds % 60;
        this.setVariableValues({
            stream_elapsed: this.secondsToHms(totalSeconds),
            stream_elapsed_ss: String(totalSeconds),
            stream_elapsed_hm: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
            stream_elapsed_ms: `${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
        });
    }
    startStreamElapsedTimer() {
        if (this.streamElapsedTimer) {
            clearInterval(this.streamElapsedTimer);
            this.streamElapsedTimer = undefined;
        }
        if (!this.currentEventId || !this.eventMediaStartEpochMs)
            return;
        this.updateStreamElapsed();
        this.streamElapsedTimer = setInterval(() => {
            this.updateStreamElapsed();
        }, 1000);
    }
    async init(config, _isFirstInit, secrets) {
        this.config = config;
        this.secrets = secrets ?? {};
        this.updateStatus(InstanceStatus.Connecting, 'Initializing');
        this.updateActions();
        this.updateFeedbacks();
        this.updatePresets();
        this.updateVariableDefinitions();
        // Auth + customerId
        await this.refreshProfileSmart(false);
        // Load venues/players once
        await this.refreshVenuesAndPlayers();
        // Auto-select default player if configured
        if (this.config.defaultPlayerHardwareId) {
            await this.selectPlayer(this.config.defaultPlayerHardwareId);
        }
        if (this.config.defaultEncoderId) {
            await this.selectEncoder(this.config.defaultEncoderId);
        }
        // Start background polling
        this.startPolling();
    }
    async configUpdated(config, secrets) {
        this.config = config;
        this.secrets = secrets ?? {};
        // Re-auth (ensures customerId) then refresh lists
        await this.refreshProfileSmart(true);
        await this.refreshVenuesAndPlayers();
        // Auto-select default player if configured
        if (this.config.defaultPlayerHardwareId) {
            await this.selectPlayer(this.config.defaultPlayerHardwareId);
        }
    }
    // Return config fields for web config
    getConfigFields() {
        const fields = GetConfigFields();
        // Patch in current player choices
        for (const f of fields) {
            if (f.type === 'dropdown' && f.id === 'defaultPlayerHardwareId') {
                f.choices = [{ id: '', label: '(none)' }, ...this.getPlayerChoices()];
            }
            if (f.type === 'dropdown' && f.id === 'defaultEncoderId') {
                f.choices = [
                    { id: '', label: '(none)' },
                    ...this.encoderChoices,
                ];
            }
        }
        return fields;
    }
    updateActions() {
        UpdateActions(this);
    }
    updateFeedbacks() {
        UpdateFeedbacks(this);
    }
    updatePresets() {
        UpdatePresets(this);
    }
    updateVariableDefinitions() {
        UpdateVariableDefinitions(this);
    }
    async refreshProfileSmart(forceLogin = false) {
        try {
            await this.ensureAuthenticated(forceLogin);
            if (!this.cookieHeader)
                return; // missing creds or login not possible yet
            await this.fetchProfile();
            this.updateStatus(InstanceStatus.Ok);
            this.setVariableValues({ auth_status: 'OK', last_error: '' });
        }
        catch (err) {
            const msg = err?.message ?? String(err);
            this.setVariableValues({ auth_status: 'Auth/profile failed', last_error: msg });
            this.log('error', `Refresh failed: ${msg}`);
            this.updateStatus(InstanceStatus.ConnectionFailure, 'Refresh failed');
            throw err;
        }
    }
    async resiLogin(username, password) {
        const res = await fetch('https://central.resi.io/api/v3/login?newToken=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ userName: username, password }),
        });
        if (!res.ok) {
            let detail = '';
            const j = (await res.json().catch(() => undefined));
            if (j)
                detail = String(j?.message ?? j?.error ?? JSON.stringify(j));
            else
                detail = await res.text().catch(() => '');
            throw new Error(`Login failed (${res.status}) ${detail}`.trim());
        }
        // Node 18+ (Companion) supports getSetCookie()
        const setCookies = res.headers.getSetCookie?.() ??
            (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
        const cookies = {};
        for (const sc of setCookies) {
            const first = sc.split(';')[0];
            const idx = first.indexOf('=');
            if (idx > 0)
                cookies[first.slice(0, idx)] = first.slice(idx + 1);
        }
        this.refreshToken = cookies.refreshToken;
        this.livingas1 = cookies.livingas1;
        const parts = [];
        if (this.refreshToken)
            parts.push(`refreshToken=${this.refreshToken}`);
        if (this.livingas1)
            parts.push(`livingas1=${this.livingas1}`);
        this.cookieHeader = parts.join('; ');
    }
    async getUsersMe() {
        const res = await fetch('https://central.resi.io/api_v2.svc/users/me', {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Cookie: this.cookieHeader,
                ...(this.livingas1 ? { authorization: `X-Bearer ${this.livingas1}` } : {}),
            },
        });
        if (!res.ok) {
            throw new Error(`/users/me failed (${res.status})`);
        }
        return res.json();
    }
    async ensureAuthenticated(force = false) {
        const username = this.config.username;
        const password = this.secrets?.password;
        if (!username || !password) {
            this.updateStatus(InstanceStatus.BadConfig, 'Missing username/password');
            this.setVariableValues({
                auth_status: 'Missing credentials',
                last_error: 'Enter username/password in config',
            });
            return;
        }
        // If we already have cookies and it hasn’t been too long, skip login
        const ageMs = Date.now() - this.lastLoginMs;
        const shouldRelogin = force || !this.cookieHeader || ageMs > 50 * 60 * 1000; // 50 minutes
        if (!shouldRelogin)
            return;
        // De-dupe concurrent logins
        if (!this.loginInFlight) {
            this.loginInFlight = (async () => {
                try {
                    this.updateStatus(InstanceStatus.Connecting, 'Logging in');
                    await this.resiLogin(username, password);
                    this.lastLoginMs = Date.now();
                    this.updateStatus(InstanceStatus.Ok, 'Connected');
                    this.setVariableValues({ auth_status: 'OK', last_error: '' });
                }
                catch (err) {
                    const msg = err?.message ?? String(err);
                    this.updateStatus(InstanceStatus.ConnectionFailure, 'Auth failed');
                    this.setVariableValues({ auth_status: 'Auth failed', last_error: msg });
                    throw err;
                }
            })().finally(() => {
                this.loginInFlight = undefined;
            });
        }
        await this.loginInFlight;
    }
    async fetchProfile() {
        this.updateStatus(InstanceStatus.Connecting, 'Fetching profile');
        const me = await this.getUsersMe();
        this.customerId = me.customerId;
        this.setVariableValues({
            org_name: me.customerName ?? '',
            first_name: me.firstName ?? '',
            last_name: me.lastName ?? '',
            email: me.userName ?? '',
        });
        return me;
    }
    async refreshProfileNow() {
        await this.refreshProfileSmart(true); // force login on manual refresh
        this.setVariableValues({ last_poll: new Date().toLocaleString() });
    }
    getEncoderChoices() {
        const choices = [];
        for (const event of this.events) {
            if (!event.encoderId)
                continue;
            if (choices.some((choice) => choice.id === event.encoderId)) {
                continue;
            }
            choices.push({
                id: event.encoderId,
                label: event.encoderName ?? event.encoderId,
            });
        }
        this.encoderChoices = choices;
        return choices;
    }
    getPlayerChoices() {
        const choices = [];
        for (const v of this.venues) {
            const players = this.playersByVenueUuid[v.uuid] ?? [];
            for (const p of players) {
                choices.push({
                    id: p.playerHardwareId,
                    label: `${v.userName} → ${p.userName} (${p.playerHardwareId})`,
                });
            }
        }
        return choices;
    }
    getEventChoices() {
        return [
            { id: '', label: '(none)' },
            ...this.events.map((event) => ({
                id: event.uuid,
                label: event.name,
            })),
        ];
    }
    async refreshListsNow() {
        await this.refreshProfileSmart(false);
        await this.refreshVenuesAndPlayers();
    }
    async selectPlayer(playerHardwareId) {
        this.selectedPlayerHardwareId = playerHardwareId;
        // find which venue it's in
        this.selectedVenueUuid = undefined;
        for (const v of this.venues) {
            if ((this.playersByVenueUuid[v.uuid] ?? []).some((p) => p.playerHardwareId === playerHardwareId)) {
                this.selectedVenueUuid = v.uuid;
                break;
            }
        }
        this.setVariableValues({
            auth_status: this.selectedVenueUuid ? 'Player selected' : 'Player selected (venue not found)',
        });
        this.startPlayerPolling();
    }
    async selectEvent(eventId) {
        const id = eventId.trim();
        if (!id) {
            this.currentEventId = undefined;
            this.currentEventProfileId = undefined;
            this.cues = [];
            this.setVariableValues({
                event_id: '',
                event_name: 'OFFLINE',
                cue_count: '0',
                cue_names: '',
                stream_elapsed: '',
                stream_elapsed_ss: '',
            });
            this.log('info', 'Event selection cleared');
            return;
        }
        const event = this.events.find((e) => e.uuid === id);
        if (!event) {
            throw new Error(`Event not found: ${id}`);
        }
        this.currentEventId = event.uuid;
        this.currentEventProfileId = undefined;
        this.eventMediaStartEpochMs = undefined;
        this.setVariableValues({
            event_id: event.uuid,
            event_name: event.name,
        });
        await this.refreshEventProfileAndCues();
        this.log('info', `Selected event "${event.name}" (${this.currentEventId})`);
    }
    startPlayerPolling() {
        if (this.playerPollTimer)
            clearInterval(this.playerPollTimer);
        const ms = Math.max(250, Number(this.config.playerPollMs ?? 2000) || 2000);
        this.playerPollTimer = setInterval(() => {
            void this.pollPlayer();
        }, ms);
    }
    async pollPlayer() {
        if (this.playerPollInFlight)
            return;
        this.playerPollInFlight = true;
        try {
            if (!this.selectedVenueUuid || !this.selectedPlayerHardwareId)
                return;
            await this.ensureAuthenticated(false);
            if (!this.cookieHeader)
                return;
            const res = await fetch(`https://central.resi.io/api_v2.svc/users/${this.selectedVenueUuid}/players`, {
                method: 'GET',
                headers: this.buildAuthHeaders(),
            });
            if (!res.ok)
                throw new Error(`players poll failed (${res.status})`);
            const players = (await res.json());
            const p = players.find((x) => x.playerHardwareId === this.selectedPlayerHardwareId);
            // Guard: player not found
            if (!p) {
                this.setVariableValues({
                    auth_status: 'Selected player not found',
                    last_error: 'Selected playerHardwareId not present in /players response',
                });
                return;
            }
            const posMs = this.parseTimeToMs(p.position ?? '00:00:00');
            const eventId = p.eventId ?? undefined;
            const posSec = Math.floor(posMs / 1000);
            if (this.lastPositionSec === undefined || this.lastPositionSec !== posSec) {
                this.lastPositionSec = posSec;
                this.setVariableValues({
                    playback_last_change_epoch_ms: String(Date.now()),
                });
            }
            this.setVariableValues({
                current_position: p.position ?? '',
                current_position_sec: String(posSec),
                current_event_id: eventId ?? '',
                last_error: '',
            });
            this.lastPlayerPosition = p.position ?? '';
            // If event changed, refresh cues + capture event startTime -> eventMediaStartEpochMs
            if (eventId && eventId !== this.currentEventId) {
                this.currentEventId = eventId;
                this.eventMediaStartEpochMs = undefined;
                await this.refreshEventProfileAndCues();
            }
            // Keep next/prev cue vars live
            this.computeAndSetCueVars(posMs);
            await this.refreshCuesIfDue();
        }
        catch (err) {
            const msg = err?.message ?? String(err);
            this.log('warn', `Player poll failed: ${msg}`);
            this.setVariableValues({
                auth_status: 'Player poll failed',
                last_error: msg,
            });
        }
        finally {
            this.playerPollInFlight = false;
        }
    }
    async refreshEventProfileAndCues() {
        if (!this.customerId || !this.currentEventId)
            return;
        await this.ensureAuthenticated(false);
        if (!this.cookieHeader)
            return;
        const evRes = await fetch(`https://central.resi.io/api/v3/customers/${this.customerId}/events/${this.currentEventId}`, { method: 'GET', headers: this.buildAuthHeaders() });
        if (!evRes.ok)
            throw new Error(`event detail failed (${evRes.status})`);
        const ev = (await evRes.json());
        this.currentEventProfileId = ev.eventProfileId;
        // anchor ToD off event startTime
        if (ev.startTime) {
            const t = Date.parse(ev.startTime);
            if (!Number.isNaN(t))
                this.eventMediaStartEpochMs = t;
        }
        // cues
        const cuesRes = await fetch(`https://central.resi.io/api_v2.svc/streamprofiles/${this.currentEventProfileId}/events/${this.currentEventId}/cues?canISetCues=1`, { method: 'GET', headers: this.buildAuthHeaders() });
        if (!cuesRes.ok)
            throw new Error(`cues failed (${cuesRes.status})`);
        const cuesJson = (await cuesRes.json());
        this.cues = cuesJson
            .map((c) => ({
            uuid: c.uuid,
            name: c.name,
            user: c.user,
            privateCue: c.privateCue,
            positionMs: this.parseTimeToMs(c.position),
        }))
            .sort((a, b) => a.positionMs - b.positionMs);
        this.log('info', `Loaded ${this.cues.length} cues for event ${this.currentEventId}`);
        this.setVariableValues({
            event_id: this.currentEventId ?? '',
            cue_count: String(this.cues.length),
            cue_names: this.cues.map((c) => c.name).join(', '),
        });
    }
    startPolling() {
        if (this.pollTimer)
            clearInterval(this.pollTimer);
        const ms = Math.max(10000, Number(this.config.listPollMs ?? 120000) || 120000);
        this.pollTimer = setInterval(() => {
            void this.pollOnce(false);
        }, ms);
        setTimeout(() => void this.pollOnce(false), 2000);
    }
    async pollOnce(isManual) {
        if (this.pollInFlight)
            return;
        this.pollInFlight = true;
        try {
            await this.ensureAuthenticated(false);
            if (!this.cookieHeader)
                return;
            try {
                await this.fetchProfile();
            }
            catch (err) {
                const status = err?.status ?? err?.response?.status;
                const msg = err?.message ?? String(err);
                if (String(msg).includes('401') || String(msg).includes('403') || status === 401 || status === 403) {
                    await this.ensureAuthenticated(true);
                    await this.fetchProfile();
                }
                else {
                    throw err;
                }
            }
            // Optionally keep lists fresh on the same interval:
            await this.refreshVenuesAndPlayers();
            this.setVariableValues({
                last_poll: new Date().toLocaleString(),
            });
            this.updateStatus(InstanceStatus.Ok);
        }
        catch (err) {
            const msg = err?.message ?? String(err);
            this.setVariableValues({
                auth_status: isManual ? 'Manual refresh failed' : 'Poll failed',
                last_error: msg,
                last_poll: new Date().toLocaleString(),
            });
            this.updateStatus(InstanceStatus.ConnectionFailure, 'Poll failed');
        }
        finally {
            this.pollInFlight = false;
        }
    }
    buildAuthHeaders() {
        return {
            Accept: 'application/json',
            Cookie: this.cookieHeader,
            ...(this.livingas1 ? { authorization: `X-Bearer ${this.livingas1}` } : {}),
        };
    }
    parseTimeToMs(s) {
        // Accept: "HH:MM:SS", "HH:MM:SS.mmm", "MM:SS", "MM:SS.mmm", "SS", "SS.mmm"
        if (!s || typeof s !== 'string')
            return 0;
        const [timePart, msPartRaw] = s.trim().split('.');
        const parts = timePart.split(':').map((p) => p.trim()).filter(Boolean);
        const msPart = msPartRaw ? msPartRaw.padEnd(3, '0').slice(0, 3) : '0';
        const ms = Number(msPart);
        let hh = 0, mm = 0, ss = 0;
        if (parts.length === 3) {
            hh = Number(parts[0]);
            mm = Number(parts[1]);
            ss = Number(parts[2]);
        }
        else if (parts.length === 2) {
            mm = Number(parts[0]);
            ss = Number(parts[1]);
        }
        else if (parts.length === 1) {
            ss = Number(parts[0]);
        }
        else {
            return 0;
        }
        if (![hh, mm, ss, ms].every((n) => Number.isFinite(n)))
            return 0;
        return ((hh * 60 + mm) * 60 + ss) * 1000 + ms;
    }
    msToHms(ms) {
        const total = Math.max(0, Math.floor(ms));
        const hh = Math.floor(total / 3600000);
        const mm = Math.floor((total % 3600000) / 60000);
        const ss = Math.floor((total % 60000) / 1000);
        const mmm = total % 1000;
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`;
    }
    formatTod(epochMs) {
        // 24-hour time, Companion host timezone
        return new Date(epochMs).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    }
    secondsToHms(totalSeconds) {
        const s = Math.max(0, Math.floor(totalSeconds));
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    computeAndSetCueVars(posMs) {
        if (!Number.isFinite(posMs)) {
            this.log('warn', `posMs is not finite. current_position parse failed.`);
            this.setVariableValues({
                next_cue_name: '',
                next_cue_time_in_seconds: '',
                next_cue_time_in_hms: '',
                next_cue_position: '',
                next_cue_tod: '',
                prev_cue_name: '',
                prev_cue_time_ago_in_seconds: '',
                prev_cue_time_ago_in_hms: '',
                prev_cue_position: '',
                prev_cue_tod: '',
            });
            return;
        }
        if (!this.cues || this.cues.length === 0) {
            this.setVariableValues({
                next_cue_name: '',
                next_cue_time_in_seconds: '',
                next_cue_time_in_hms: '',
                next_cue_position: '',
                next_cue_tod: '',
                prev_cue_name: '',
                prev_cue_time_ago_in_seconds: '',
                prev_cue_time_ago_in_hms: '',
                prev_cue_position: '',
                prev_cue_tod: '',
            });
            return;
        }
        // Find next cue (first > posMs) and prev cue (last <= posMs)
        let next;
        let prev;
        for (const c of this.cues) {
            if (c.positionMs > posMs) {
                next = c;
                break;
            }
            prev = c;
        }
        const vars = {};
        // --- NEXT ---
        if (next) {
            const secsUntil = Math.max(0, Math.ceil((next.positionMs - posMs) / 1000));
            vars.next_cue_name = next.name ?? '';
            vars.next_cue_time_in_seconds = String(secsUntil);
            vars.next_cue_time_in_hms = this.secondsToHms(secsUntil);
            vars.next_cue_position = this.msToHms(next.positionMs);
            vars.next_cue_tod = this.eventMediaStartEpochMs
                ? this.formatTod(this.eventMediaStartEpochMs + next.positionMs)
                : '';
        }
        else {
            // Optional fallback if user wants a default countdown when there is no "next cue"
            const fallback = Number(this.config.noNextCueSeconds ?? 0);
            const secs = Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : NaN;
            vars.next_cue_name = '';
            vars.next_cue_time_in_seconds = Number.isFinite(secs) ? String(secs) : '';
            vars.next_cue_time_in_hms = Number.isFinite(secs) ? this.secondsToHms(secs) : '';
            vars.next_cue_position = '';
            vars.next_cue_tod = '';
        }
        // --- PREV ---
        if (prev) {
            const secsAgo = Math.max(0, Math.floor((posMs - prev.positionMs) / 1000));
            vars.prev_cue_name = prev.name ?? '';
            vars.prev_cue_time_ago_in_seconds = String(secsAgo);
            vars.prev_cue_time_ago_in_hms = this.secondsToHms(secsAgo);
            vars.prev_cue_position = this.msToHms(prev.positionMs);
            vars.prev_cue_tod = this.eventMediaStartEpochMs
                ? this.formatTod(this.eventMediaStartEpochMs + prev.positionMs)
                : '';
        }
        else {
            vars.prev_cue_name = '';
            vars.prev_cue_time_ago_in_seconds = '';
            vars.prev_cue_time_ago_in_hms = '';
            vars.prev_cue_position = '';
            vars.prev_cue_tod = '';
        }
        this.setVariableValues(vars);
    }
    async refreshVenuesAndPlayers() {
        if (!this.customerId)
            return;
        await this.ensureAuthenticated(false);
        if (!this.cookieHeader)
            return;
        // venues
        const venuesRes = await fetch(`https://central.resi.io/api/v3/customers/${this.customerId}/venues`, {
            method: 'GET',
            headers: this.buildAuthHeaders(),
        });
        if (!venuesRes.ok)
            throw new Error(`venues failed (${venuesRes.status})`);
        const venuesJson = (await venuesRes.json());
        this.venues = venuesJson;
        // events
        const eventsRes = await fetch(`https://central.resi.io/api/v3/customers/${this.customerId}/events`, {
            method: 'GET',
            headers: this.buildAuthHeaders(),
        });
        if (!eventsRes.ok)
            throw new Error(`events failed (${eventsRes.status})`);
        const eventsJson = (await eventsRes.json());
        this.events = eventsJson;
        this.encoderChoices = this.getEncoderChoices();
        // players per venue
        this.playersByVenueUuid = {};
        for (const v of this.venues) {
            const playersRes = await fetch(`https://central.resi.io/api_v2.svc/users/${v.uuid}/players`, {
                method: 'GET',
                headers: this.buildAuthHeaders(),
            });
            if (!playersRes.ok)
                continue;
            const playersJson = (await playersRes.json());
            this.playersByVenueUuid[v.uuid] = playersJson.map((p) => ({
                playerHardwareId: p.playerHardwareId,
                userName: p.userName,
                position: p.position,
                eventId: p.eventId,
            }));
        }
        // refresh action dropdown choices
        this.updateActions();
    }
    async getSelectedEncoderStatus() {
        if (!this.customerId || !this.selectedEncoderId)
            return undefined;
        const url = `https://central.resi.io/api/v3/customers/${this.customerId}/encoders/status`;
        const res = await fetch(url, {
            method: 'GET',
            headers: this.buildAuthHeaders(),
        });
        if (!res.ok) {
            throw new Error(`Encoder status request failed (${res.status})`);
        }
        const encoders = (await res.json());
        const encoder = encoders.find((encoder) => encoder.uuid === this.selectedEncoderId);
        return encoder?.status;
    }
    async findActiveEventForEncoder() {
        if (!this.customerId)
            return;
        if (!this.selectedEncoderId) {
            this.log('warn', 'AUTO EVENT: No encoder selected');
            return;
        }
        await this.ensureAuthenticated(false);
        if (!this.cookieHeader)
            return;
        const encoderStatus = await this.getSelectedEncoderStatus();
        if (encoderStatus !== 'started') {
            if (this.streamElapsedTimer) {
                clearInterval(this.streamElapsedTimer);
                this.streamElapsedTimer = undefined;
            }
            this.currentEventId = undefined;
            this.currentEventProfileId = undefined;
            this.eventMediaStartEpochMs = undefined;
            this.cues = [];
            this.setVariableValues({
                event_id: '',
                event_name: 'OFFLINE',
                cue_count: '0',
                cue_names: '',
                stream_elapsed: '00:00:00',
                stream_elapsed_hm: '00:00',
                stream_elapsed_ms: '00:00',
                stream_elapsed_ss: '00',
                next_cue_name: '',
                next_cue_time_in_seconds: '',
                next_cue_time_in_hms: '',
                next_cue_position: '',
                next_cue_tod: '',
                prev_cue_name: '',
                prev_cue_time_ago_in_seconds: '',
                prev_cue_time_ago_in_hms: '',
                prev_cue_position: '',
                prev_cue_tod: '',
            });
            this.checkFeedbacks('encoder_stream_active', 'encoder_event_active');
            return;
        }
        const url = `https://central.resi.io/api/v3/customers/${this.customerId}/events`;
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: this.buildAuthHeaders(),
            });
            if (!res.ok) {
                throw new Error(`Events request failed (${res.status})`);
            }
            const events = (await res.json());
            const now = Date.now();
            const activeEvent = events
                .filter((event) => event.encoderId === this.selectedEncoderId)
                .find((event) => {
                const start = event.startTime ? Date.parse(event.startTime) : NaN;
                const stop = event.stopAfter ? Date.parse(event.stopAfter) : NaN;
                return (!Number.isNaN(start) &&
                    !Number.isNaN(stop) &&
                    now >= start &&
                    now <= stop);
            });
            if (!activeEvent) {
                if (this.streamElapsedTimer) {
                    clearInterval(this.streamElapsedTimer);
                    this.streamElapsedTimer = undefined;
                }
                this.log('info', `AUTO EVENT: No active event found for encoder ${this.selectedEncoderId}`);
                this.currentEventId = undefined;
                this.currentEventProfileId = undefined;
                this.eventMediaStartEpochMs = undefined;
                this.cues = [];
                this.setVariableValues({
                    event_id: '',
                    event_name: 'OFFLINE',
                    cue_count: '0',
                    cue_names: '',
                    stream_elapsed: '00:00:00',
                    stream_elapsed_hm: '00:00',
                    stream_elapsed_ms: '00:00',
                    stream_elapsed_ss: '00',
                    next_cue_name: '',
                    next_cue_time_in_seconds: '',
                    next_cue_time_in_hms: '',
                    next_cue_position: '',
                    next_cue_tod: '',
                    prev_cue_name: '',
                    prev_cue_time_ago_in_seconds: '',
                    prev_cue_time_ago_in_hms: '',
                    prev_cue_position: '',
                    prev_cue_tod: '',
                });
                this.checkFeedbacks('encoder_stream_active', 'encoder_event_active');
                return;
            }
            if (activeEvent.uuid === this.currentEventId) {
                return;
            }
            this.log('info', `AUTO EVENT: Active event detected: "${activeEvent.name}" (${activeEvent.uuid})`);
            this.currentEventId = activeEvent.uuid;
            this.currentEventProfileId = undefined;
            this.eventMediaStartEpochMs = undefined;
            this.setVariableValues({
                event_id: activeEvent.uuid,
                event_name: activeEvent.name,
            });
            this.checkFeedbacks('encoder_stream_active', 'encoder_event_active');
            await this.refreshEventProfileAndCues();
            if (this.eventMediaStartEpochMs) {
                const currentPositionMs = Date.now() - this.eventMediaStartEpochMs;
                this.computeAndSetCueVars(currentPositionMs);
            }
            this.startStreamElapsedTimer();
            this.log('info', `AUTO EVENT: Loaded "${activeEvent.name}" with ${this.cues.length} cues`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log('warn', `AUTO EVENT: Failed to find active event: ${msg}`);
        }
    }
    startEncoderEventPolling() {
        if (this.encoderEventPollTimer) {
            clearInterval(this.encoderEventPollTimer);
            this.encoderEventPollTimer = undefined;
        }
        if (!this.selectedEncoderId)
            return;
        const poll = async () => {
            if (this.encoderEventPollInFlight)
                return;
            this.encoderEventPollInFlight = true;
            try {
                await this.findActiveEventForEncoder();
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.log('warn', `AUTO EVENT POLL: ${msg}`);
            }
            finally {
                this.encoderEventPollInFlight = false;
            }
        };
        void poll();
        this.encoderEventPollTimer = setInterval(poll, 10000);
    }
    lookupCueByName(queryRaw, mode = 'exact') {
        const query = (queryRaw ?? '').trim();
        this.setVariableValues({ lookup_cue_query: query });
        if (!query) {
            this.setVariableValues({
                lookup_cue_found: 'false',
                lookup_cue_name: '',
                lookup_cue_uuid: '',
                lookup_cue_position: '',
                lookup_cue_position_sec: '',
                lookup_cue_tod: '',
            });
            return;
        }
        const norm = (s) => s.trim().toLowerCase();
        const match = mode === 'contains'
            ? this.cues.find((c) => norm(c.name).includes(norm(query)))
            : this.cues.find((c) => norm(c.name) === norm(query));
        if (!match) {
            this.setVariableValues({
                lookup_cue_found: 'false',
                lookup_cue_name: '',
                lookup_cue_uuid: '',
                lookup_cue_position: '',
                lookup_cue_position_sec: '',
                lookup_cue_tod: '',
            });
            return;
        }
        this.setVariableValues({
            lookup_cue_found: 'true',
            lookup_cue_name: match.name ?? '',
            lookup_cue_uuid: match.uuid ?? '',
            lookup_cue_position: this.msToHms(match.positionMs),
            lookup_cue_position_sec: String(Math.floor(match.positionMs / 1000)),
            lookup_cue_tod: this.eventMediaStartEpochMs ? this.formatTod(this.eventMediaStartEpochMs + match.positionMs) : '',
        });
    }
    isValidHmsMs(s) {
        // Accept HH:MM:SS or HH:MM:SS.mmm (hours can be 1+ digits)
        return /^\d+:[0-5]\d:[0-5]\d(\.\d{1,3})?$/.test(s.trim());
    }
    normalizeHmsMs(s) {
        // Ensure we always send HH:MM:SS.mmm
        const trimmed = (s ?? '').trim();
        const [timePart, msRaw] = trimmed.split('.');
        const ms = (msRaw ?? '0').padEnd(3, '0').slice(0, 3);
        // If they typed "4:00:00", keep it (hours can be 1 digit) but add .mmm
        return `${timePart}.${ms}`;
    }
    async refreshCuesIfDue() {
        // Must have an event loaded
        if (!this.currentEventId || !this.currentEventProfileId)
            return;
        // Don’t overlap cue refreshes
        if (this.cueRefreshInFlight)
            return;
        // How often to refresh cues while playing (ms)
        // If you want “every player poll”, set this to your playerPollMs,
        // but recommended: 10000–30000.
        const intervalMs = Math.max(2000, Number(this.config.cuePollMs ?? 15000) || 15000);
        const now = Date.now();
        if (now - this.lastCueRefreshMs < intervalMs)
            return;
        this.cueRefreshInFlight = true;
        this.lastCueRefreshMs = now;
        try {
            await this.refreshEventProfileAndCues();
        }
        catch (err) {
            // Don’t hard-fail playback polling if cues refresh fails
            this.log('warn', `Cue refresh failed: ${err?.message ?? err}`);
        }
        finally {
            this.cueRefreshInFlight = false;
        }
    }
    /**
     * Adds a cue to the currently-selected event, at either current player position or a custom time.
     */
    async addCueFromPosition(opts) {
        const cueName = (opts.name ?? '').trim();
        if (!cueName)
            throw new Error('Cue name is required');
        if (!this.currentEventId || !this.currentEventProfileId) {
            throw new Error('No active event loaded yet. Select a player/event first.');
        }
        const user = (this.config.username ?? '').trim();
        if (!user)
            throw new Error('Missing username (needed for cue user field)');
        let position = '';
        if (opts.positionMode === 'event') {
            if (!this.eventMediaStartEpochMs) {
                await this.refreshEventProfileAndCues();
            }
            const elapsedMs = this.getCurrentEncoderPositionMs();
            if (elapsedMs === undefined) {
                throw new Error('Current event position is not available yet');
            }
            position = this.msToHms(elapsedMs);
        }
        else if (opts.positionMode === 'player') {
            // First choice: actual decoder/player position
            const playerPosition = (this.lastPlayerPosition ?? '').trim();
            if (playerPosition && this.isValidHmsMs(playerPosition)) {
                position = this.normalizeHmsMs(playerPosition);
            }
            else {
                // Fallback: calculate current position from the active event startTime
                const elapsedMs = this.getCurrentEncoderPositionMs();
                if (elapsedMs === undefined) {
                    throw new Error('Current encoder/event position is not available yet');
                }
                position = this.msToHms(elapsedMs);
            }
        }
        else {
            const custom = (opts.customPosition ?? '').trim();
            if (!custom) {
                throw new Error('Custom position is required');
            }
            if (!this.isValidHmsMs(custom)) {
                throw new Error('Custom position must be like HH:MM:SS or HH:MM:SS.mmm');
            }
            position = this.normalizeHmsMs(custom);
        }
        await this.ensureAuthenticated(false);
        if (!this.cookieHeader)
            return;
        const url = `https://central.resi.io/api_v2.svc/streamprofiles/${this.currentEventProfileId}/events/${this.currentEventId}/cues`;
        const body = { position, name: cueName, privateCue: !!opts.privateCue, user };
        const res = await fetch(url, {
            method: 'POST',
            headers: { ...this.buildAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Add cue failed (${res.status}) ${text}`.trim());
        }
        this.log('info', `Added cue "${cueName}" at ${position}`);
        await this.refreshEventProfileAndCues();
    }
    async selectEncoder(encoderId) {
        const id = encoderId.trim();
        if (!id) {
            this.selectedEncoderId = undefined;
            this.setVariableValues({
                encoder_name: 'NONE',
            });
            if (this.encoderEventPollTimer) {
                clearInterval(this.encoderEventPollTimer);
                this.encoderEventPollTimer = undefined;
            }
            this.log('info', 'Encoder selection cleared');
            return;
        }
        this.selectedEncoderId = id;
        const encoderName = this.getEncoderChoices().find((choice) => choice.id === id)?.label ?? id;
        this.setVariableValues({
            encoder_name: encoderName,
        });
        this.log('info', `Selected encoder "${encoderName}" (${id})`);
        await this.findActiveEventForEncoder();
        this.startEncoderEventPolling();
    }
    async deleteCueByName(opts) {
        const query = (opts.name ?? '').trim();
        if (!query)
            throw new Error('Cue name is required');
        if (!this.currentEventId || !this.currentEventProfileId) {
            throw new Error('No active event loaded yet. Select a player/event first.');
        }
        // Make sure we have current cues loaded
        if (!this.cues || this.cues.length === 0) {
            await this.refreshEventProfileAndCues();
        }
        const norm = (s) => s.trim().toLowerCase();
        const qn = norm(query);
        // Note: your this.cues is { uuid, name, positionMs } (no user field),
        // so if you want onlyMine filtering, we need to store "user" too when loading cues.
        // For now, onlyMine will be best-effort if you extend cues to include user.
        const myUser = (this.config.username ?? '').trim().toLowerCase();
        // If you haven't extended cue storage with user, this will just skip that filter.
        const cuesAny = this.cues;
        const matches = cuesAny.filter((c) => {
            const nameOk = opts.matchMode === 'contains' ? norm(c.name ?? '').includes(qn) : norm(c.name ?? '') === qn;
            if (!nameOk)
                return false;
            if (opts.onlyMine) {
                // works only if c.user exists
                if (typeof c.user !== 'string')
                    return false;
                return c.user.trim().toLowerCase() === myUser;
            }
            return true;
        });
        if (matches.length === 0) {
            throw new Error(`No cue matched "${query}"`);
        }
        const toDelete = opts.deleteMode === 'all' ? matches : [matches[0]];
        await this.ensureAuthenticated(false);
        let deleted = 0;
        for (const c of toDelete) {
            const uuid = String(c.uuid ?? '').trim();
            if (!uuid)
                continue;
            const url = `https://central.resi.io/api_v2.svc/streamprofiles/${this.currentEventProfileId}/events/${this.currentEventId}/cues/${uuid}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: this.buildAuthHeaders(),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Delete cue failed (${res.status}) ${text}`.trim());
            }
            deleted++;
        }
        this.log('info', `Deleted ${deleted} cue(s) matching "${query}"`);
        await this.refreshEventProfileAndCues();
    }
    async destroy() {
        if (this.pollTimer)
            clearInterval(this.pollTimer);
        if (this.playerPollTimer)
            clearInterval(this.playerPollTimer);
        if (this.encoderEventPollTimer)
            clearInterval(this.encoderEventPollTimer);
        if (this.streamElapsedTimer)
            clearInterval(this.streamElapsedTimer);
        this.pollTimer = undefined;
        this.playerPollTimer = undefined;
        this.encoderEventPollTimer = undefined;
        this.streamElapsedTimer = undefined;
    }
}
export default ModuleInstance;
//# sourceMappingURL=main.js.map