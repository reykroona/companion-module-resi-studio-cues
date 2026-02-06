import type { SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	username?: string
	defaultPlayerHardwareId?: string
	playerPollMs?: number
	listPollMs?: number
	noNextCueSeconds?: number
	cuePollMs?: number

}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'username',
			label: 'Username / Email',
			width: 12,
		},

		{
			type: 'dropdown',
			id: 'defaultPlayerHardwareId',
			label: 'Default decoder/player on startup',
			width: 12,
			default: '',
			choices: [{ id: '', label: '(none)' }],
		},

		// NEW: polling intervals
		{
			type: 'number',
			id: 'playerPollMs',
			label: 'Player position & cue poll (ms)',
			width: 6,
			min: 250,
			max: 30000,
			default: 2000,
		},
		{
			type: 'number',
			id: 'listPollMs',
			label: 'User & decoder inf0 poll (ms)',
			width: 6,
			min: 10000,
			max: 3600000,
			default: 120000,
		},

{
  type: 'secret-text',
  id: 'password',
  label: 'Password',
  width: 12,
}

	]
}


