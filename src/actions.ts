import type { ModuleInstance } from './main.js'

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		refresh_profile: {
			name: 'Refresh profile (users/me)',
			options: [],
			callback: async () => {
				await self.refreshProfileNow()
			},
		},

		refresh_lists: {
			name: 'Refresh venues/players list',
			options: [],
			callback: async () => {
				await self.refreshListsNow()
			},
		},

		add_cue_at_position: {
			name: 'Add cue at player position (or custom time)',
			options: [
				{
					id: 'name',
					type: 'textinput',
					label: 'Cue name',
					default: 'Web Cue',
					useVariables: true,
				},
				{
					id: 'privateCue',
					type: 'checkbox',
					label: 'Private cue',
					default: false,
				},
				{
					id: 'positionMode',
					type: 'dropdown',
					label: 'Position source',
					default: 'player',
					choices: [
						{ id: 'player', label: 'Player position (current)' },
						{ id: 'custom', label: 'Custom time' },
					],
				},
				{
					id: 'customPosition',
					type: 'textinput',
					label: 'Custom position (HH:MM:SS or HH:MM:SS.mmm)',
					default: '00:00:00.000',
					useVariables: true,
				},
			],
			callback: async (evt) => {
				const name = (await self.parseVariablesInString(String(evt.options.name ?? ''))).trim()
				const privateCue = Boolean(evt.options.privateCue)
				const positionMode = String(evt.options.positionMode ?? 'player') as 'player' | 'custom'
				const customPosition = (await self.parseVariablesInString(String(evt.options.customPosition ?? ''))).trim()

				await self.addCueFromPosition({
					name,
					privateCue,
					positionMode,
					customPosition,
				})
				
			},
		},

		delete_cue_by_name: {
			name: 'Delete cue by name',
			options: [
				{
					id: 'cueName',
					type: 'textinput',
					label: 'Cue name',
					default: '',
					useVariables: true,
				},
				{
					id: 'matchMode',
					type: 'dropdown',
					label: 'Match mode',
					default: 'exact',
					choices: [
						{ id: 'exact', label: 'Exact (case-insensitive)' },
						{ id: 'contains', label: 'Contains (case-insensitive)' },
					],
				},
				{
					id: 'deleteMode',
					type: 'dropdown',
					label: 'Delete',
					default: 'first',
					choices: [
						{ id: 'first', label: 'First match only' },
						{ id: 'all', label: 'All matches' },
					],
				},
				{
					id: 'onlyMine',
					type: 'checkbox',
					label: 'Only delete cues created by this user',
					default: true,
				},
			],
			callback: async (evt) => {
				const cueName = await self.parseVariablesInString(String(evt.options.cueName ?? ''))
				const matchMode = String(evt.options.matchMode ?? 'exact') as 'exact' | 'contains'
				const deleteMode = String(evt.options.deleteMode ?? 'first') as 'first' | 'all'
				const onlyMine = Boolean(evt.options.onlyMine)

				await self.deleteCueByName({
					name: cueName,
					matchMode,
					deleteMode,
					onlyMine,
				})
			},
		},

		select_decoder: {
			name: 'Select decoder/player',
			options: [
				{
					id: 'playerId',
					type: 'dropdown',
					label: 'Decoder / Player',
					default: '',
					choices: self.getPlayerChoices(),
				},
			],
			callback: async (evt) => {
				await self.selectPlayer(String(evt.options.playerId || ''))
			},
		},

		lookup_cue_by_name: {
			name: 'Lookup cue by name (stores in lookup_* variables)',
			options: [
				{
					id: 'cueName',
					type: 'textinput',
					label: 'Cue name',
					default: '',
					useVariables: true,
				},
				{
					id: 'matchMode',
					type: 'dropdown',
					label: 'Match mode',
					default: 'exact',
					choices: [
						{ id: 'exact', label: 'Exact (case-insensitive)' },
						{ id: 'contains', label: 'Contains (case-insensitive)' },
					],
				},
			],
			callback: async (evt) => {
				const cueName = await self.parseVariablesInString(String(evt.options.cueName ?? ''))
				const mode = String(evt.options.matchMode ?? 'exact') as 'exact' | 'contains'
				self.lookupCueByName(cueName, mode)
			},
		},
	})
}
