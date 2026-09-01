import type { ModuleInstance } from './main.js'
import type { CompanionVariableDefinitions } from '@companion-module/base'

export function UpdateVariableDefinitions(instance: ModuleInstance): void {
        const vars: CompanionVariableDefinitions = {
                org_name: { name: 'Organization name' },
                first_name: { name: 'First name' },
                last_name: { name: 'Last name' },
                email: { name: 'Email' },

                auth_status: { name: 'Auth status' },
                last_error: { name: 'Last error' },
                last_poll: { name: 'Last poll (local time)' },

                current_position: { name: 'Current position (HH:MM:SS.ms)' },
                current_position_sec: { name: 'Current position (seconds)' },
                stream_elapsed: { name: 'Stream elapsed (HH:MM:SS)' },
                stream_elapsed_hm: { name: 'Stream elapsed (HH:MM)' },
                stream_elapsed_ms: { name: 'Stream elapsed (MM:SS)' },
                stream_elapsed_ss: { name: 'Stream elapsed (SS)' },
                event_name: { name: 'Current event name' },
                encoder_name: { name: 'Selected encoder name' },
                current_event_id: { name: 'Current event id (live from player)' },

                cue_count: { name: 'Cue count' },
                cue_names: { name: 'Cue names (comma separated)' },
                event_id: { name: 'Current event id (cues loaded for)' },

                next_cue_name: { name: 'Next cue name' },
                next_cue_time_in_seconds: { name: 'Seconds until next cue' },
                next_cue_position: { name: 'Next cue position (HH:MM:SS.ms)' },
                next_cue_tod: { name: 'Next cue time-of-day (24 hour)' },

                prev_cue_name: { name: 'Previous cue name' },
                prev_cue_time_ago_in_seconds: { name: 'Seconds since previous cue' },
                prev_cue_position: { name: 'Previous cue position (HH:MM:SS.ms)' },
                prev_cue_tod: { name: 'Previous cue time-of-day (24 hour)' },

                next_cue_time_in_hms: { name: 'Time until next cue (HH:MM:SS)' },
                prev_cue_time_ago_in_hms: { name: 'Time since previous cue (HH:MM:SS)' },

                lookup_cue_query: { name: 'Lookup cue query (name)' },
                lookup_cue_found: { name: 'Lookup cue found (true/false)' },
                lookup_cue_name: { name: 'Lookup cue name (matched)' },
                lookup_cue_uuid: { name: 'Lookup cue uuid' },
                lookup_cue_position: { name: 'Lookup cue position (HH:MM:SS.ms)' },
                lookup_cue_position_sec: { name: 'Lookup cue position (seconds)' },
                lookup_cue_tod: { name: 'Lookup cue time-of-day' },
                playback_last_change_epoch_ms: { name: 'Playback last position change (epoch ms)' },
        }

        instance.setVariableDefinitions(vars)
}