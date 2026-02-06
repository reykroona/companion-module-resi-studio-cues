"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateVariableDefinitions = UpdateVariableDefinitions;
function UpdateVariableDefinitions(instance) {
    const vars = [
        { variableId: 'org_name', name: 'Organization name' },
        { variableId: 'first_name', name: 'First name' },
        { variableId: 'last_name', name: 'Last name' },
        { variableId: 'email', name: 'Email' },
        { variableId: 'auth_status', name: 'Auth status' },
        { variableId: 'last_error', name: 'Last error' },
        { variableId: 'last_poll', name: 'Last poll (local time)' },
        { variableId: 'current_position', name: 'Current position (HH:MM:SS.ms)' },
        { variableId: 'current_position_sec', name: 'Current position (seconds)' },
        { variableId: 'current_event_id', name: 'Current event id (live from player)' },
        { variableId: 'cue_count', name: 'Cue count' },
        { variableId: 'cue_names', name: 'Cue names (comma separated)' },
        { variableId: 'event_id', name: 'Current event id (cues loaded for)' },
        { variableId: 'next_cue_name', name: 'Next cue name' },
        { variableId: 'next_cue_time_in_seconds', name: 'Seconds until next cue' },
        { variableId: 'next_cue_position', name: 'Next cue position (HH:MM:SS.ms)' },
        { variableId: 'next_cue_tod', name: 'Next cue time-of-day (24 hour)' },
        { variableId: 'prev_cue_name', name: 'Previous cue name' },
        { variableId: 'prev_cue_time_ago_in_seconds', name: 'Seconds since previous cue' },
        { variableId: 'prev_cue_position', name: 'Previous cue position (HH:MM:SS.ms)' },
        { variableId: 'prev_cue_tod', name: 'Previous cue time-of-day (24 hour)' },
        { variableId: 'next_cue_time_in_hms', name: 'Time until next cue (HH:MM:SS)' },
        { variableId: 'prev_cue_time_ago_in_hms', name: 'Time since previous cue (HH:MM:SS)' },
        { variableId: 'lookup_cue_query', name: 'Lookup cue query (name)' },
        { variableId: 'lookup_cue_found', name: 'Lookup cue found (true/false)' },
        { variableId: 'lookup_cue_name', name: 'Lookup cue name (matched)' },
        { variableId: 'lookup_cue_uuid', name: 'Lookup cue uuid' },
        { variableId: 'lookup_cue_position', name: 'Lookup cue position (HH:MM:SS.ms)' },
        { variableId: 'lookup_cue_position_sec', name: 'Lookup cue position (seconds)' },
        { variableId: 'lookup_cue_tod', name: 'Lookup cue time-of-day' },
    ];
    instance.setVariableDefinitions(vars);
}
//# sourceMappingURL=variables.js.map