import env from "@/globals/env"
import database from "@/globals/database"
import * as proxmox from "@/globals/proxmox"
import getVersion from "@/index"
import * as pterodactyl from "@/globals/pterodactyl"

export const runContext = {
	/**
	 * The Environment Variables of the Server
	 * @since 1.0.0
	*/ env,
	/**
	 * The Prisma Database Connection
	 * @since 1.0.0
	*/ database,
	/**
	 * The Pterodactyl API Client
	 * @since 1.1.0
	*/ pterodactyl,
	/**
	 * The Proxmox API Client
	 * @since 1.15.0
	*/ proxmox,
	/**
	 * The App Version
	 * @since 1.0.0
	*/ appVersion: getVersion(),
	/**
	 * Create Multi Line Strings
	 * @since 1.0.0
	*/ join(...strings: (string | number | undefined | null | boolean)[]): string {
		return strings.filter((str) => str === '' || Boolean(str)).join('\n')
	}
} as const

/**
 * Reported when a crontab tick keeps getting skipped because the previous run is still going.
 * @since 1.18.0
*/ export class CrontabOverlapError extends Error {
	constructor(message: string) {
		super(message)

		this.name = 'CrontabOverlapError'
	}
}

export type MonitorOptions = {
	/**
	 * Minutes after the expected time before a check-in counts as missed
	 * @default 2
	*/ checkinMargin?: number
	/**
	 * Minutes a run may take before it counts as timed out
	 * @default 5
	*/ maxRuntime?: number
}

export default class Builder<Excluded extends (keyof Builder)[] = []> {
	protected interval: string = '* * * * *'
	protected condition: (ctx: typeof runContext) => boolean = () => true
	protected monitorSlug: ((ctx: typeof runContext) => string) | null = null
	protected monitorOptions: MonitorOptions = {}
	protected listener: (ctx: typeof runContext) => any | Promise<any> = () => undefined

	/**
	 * Set the Interval
	 * @since 1.0.0
	*/ public cron(interval: string): Omit<Builder<[...Excluded, 'cron']>, 'cron' | Excluded[number]> {
		this.interval = interval

		return this as any
	}

	/**
	 * Only run (and check in) when the condition passes
	 * @since 1.18.0
	*/ public when(condition: (ctx: typeof runContext) => boolean): Omit<Builder<[...Excluded, 'when']>, 'when' | Excluded[number]> {
		this.condition = condition

		return this as any
	}

	/**
	 * Report runs to a Sentry cron monitor, 6 field (seconds) intervals are reported at most once per minute
	 * @since 1.18.0
	*/ public monitor(slug: string | ((ctx: typeof runContext) => string), options: MonitorOptions = {}): Omit<Builder<[...Excluded, 'monitor']>, 'monitor' | Excluded[number]> {
		this.monitorSlug = typeof slug === 'string' ? () => slug : slug
		this.monitorOptions = options

		return this as any
	}

	/**
	 * Listen for The Crontab
	 * @since 1.0.0
	*/ public listen(callback: (ctx: typeof runContext) => any | Promise<any>): Omit<Builder<[...Excluded, 'listen']>, 'listen' | Excluded[number]> {
		this.listener = callback as any

		return this as any
	}
}