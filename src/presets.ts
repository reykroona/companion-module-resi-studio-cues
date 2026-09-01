import type { ModuleInstance } from './main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { combineRgb } from '@companion-module/base'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	// Helper to reference THIS instance’s variables in simple text
	// Companion variable syntax uses the instance label.
	const L = self.label

	// ----------------------------
	// STATUS / HEALTH
	// ----------------------------

	presets['status_connected'] = {
		type: 'simple',
		name: 'Connected (green) / Error (red)',
		style: {
			text: `Resi\n$(${L}:auth_status)`,
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(40, 40, 40),
			show_topbar: true,
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'resi_connected',
				options: {},
			},
			{
				feedbackId: 'resi_error',
				options: {},
			},
		],
	}

	presets['status_player_active'] = {
		type: 'simple',

		name: 'Player Active',
		style: {
			text: `Player\n$(${L}:current_position)`,
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(40, 40, 40),
			show_topbar: true,
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'player_active',
				options: {},
			},
		],
	}

	presets['status_frozen'] = {
		type: 'simple',
		name: 'Playback Frozen Warning',
		style: {
			text: `FROZEN?\n$(${L}:current_position)`,
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(40, 40, 40),
			show_topbar: true,
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'playback_frozen',
				options: {
					staleSeconds: 6,
				},
			},
		],
	}

	// ----------------------------
	// CUE DISPLAY (NO ACTIONS)
	// ----------------------------

	presets['cue_next_display'] = {
		type: 'simple',
		name: 'Next Cue Display',
		style: {
			text: `NEXT:\n$(${L}:next_cue_name)\nT- $(${L}:next_cue_time_in_hms)`,
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
			show_topbar: false,
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'approaching_next_cue',
				options: { threshold: 30 },
			},
		],
	}

	presets['cue_prev_display'] = {
		type: 'simple',
		name: 'Previous Cue Display',
		style: {
			text: `PREV:\n$(${L}:prev_cue_name)\n+ $(${L}:prev_cue_time_ago_in_hms)`,
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
			show_topbar: false,
		},
		steps: [],
		feedbacks: [],
	}

	// ----------------------------
	// MAINTENANCE / REFRESH
	// ----------------------------

	presets['refresh_profile'] = {
		type: 'simple',
		name: 'Refresh Profile',
		style: {
			text: 'Refresh\nProfile',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(60, 60, 60),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'refresh_profile',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{ feedbackId: 'resi_connected', options: {} },
			{ feedbackId: 'resi_error', options: {} },
		],
	}

	presets['refresh_lists'] = {
		type: 'simple',
		name: 'Refresh Venues/Players',
		style: {
			text: 'Refresh\nLists',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(60, 60, 60),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'refresh_lists',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{ feedbackId: 'resi_connected', options: {} },
			{ feedbackId: 'resi_error', options: {} },
		],
	}

	// ----------------------------
	// CUE ACTIONS
	// ----------------------------

	presets['add_cue_player'] = {
		type: 'simple',
		name: 'Add Cue @ Player Position',
		style: {
			text: 'Add Cue\n@ Player',
			size: '18',
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(180, 180, 180),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'add_cue_at_position',
						options: {
							name: 'Web Cue',
							privateCue: false,
							positionMode: 'player',
							customPosition: '00:00:00.000',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{ feedbackId: 'resi_connected', options: {} },
			{ feedbackId: 'resi_error', options: {} },
		],
	}

	presets['add_cue_custom'] = {
		type: 'simple',
		name: 'Add Cue @ Custom Time',
		style: {
			text: 'Add Cue\n@ Custom',
			size: '18',
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(180, 180, 180),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'add_cue_at_position',
						options: {
							// user can edit this preset, OR replace with a variable
							name: 'Custom Cue',
							privateCue: false,
							positionMode: 'custom',
							customPosition: '00:10:00.000',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{ feedbackId: 'resi_connected', options: {} },
			{ feedbackId: 'resi_error', options: {} },
		],
	}

	presets['lookup_cue'] = {
		type: 'simple',
		name: 'Lookup Cue (stores in lookup_* vars)',
		style: {
			text: 'Lookup\nCue',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 110, 200),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'lookup_cue_by_name',
						options: {
							// user edits this preset to their cue name or uses variables
							cueName: 'sermon start',
							matchMode: 'exact',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{ feedbackId: 'resi_connected', options: {} },
			{ feedbackId: 'resi_error', options: {} },
		],
	}

	presets['delete_cue'] = {
		type: 'simple',
		name: 'Delete Cue by Name',
		style: {
			text: 'DELETE\nCue',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(140, 0, 0),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'delete_cue_by_name',
						options: {
							// user edits this preset to the cue they want to delete
							cueName: 'Companion Test',
							matchMode: 'exact',
							deleteMode: 'first',
							onlyMine: true,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{ feedbackId: 'resi_connected', options: {} },
			{ feedbackId: 'resi_error', options: {} },
		],
	}
		const structure = [
			{
					id: 'status',
					name: 'Resi • Status',
					definitions: [
							'status_connected',
							'status_player_active',
							'status_frozen',
					],
			},
			{
					id: 'cues',
					name: 'Resi • Cues',
					definitions: [
							'cue_next_display',
							'cue_prev_display',
							'add_cue_player',
							'add_cue_custom',
							'lookup_cue',
							'delete_cue',
					],
			},
			{
					id: 'maintenance',
					name: 'Resi • Maintenance',
					definitions: [
							'refresh_profile',
							'refresh_lists',
					],
			},
	]

	self.setPresetDefinitions(structure, presets)
	}
