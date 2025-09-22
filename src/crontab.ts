import env from "@/globals/env"
import database from "@/globals/database"
import * as proxmox from "@/globals/proxmox"
import getVersion from "@/index"
import * as pterodactyl from "@/globals/pterodactyl"
import { client } from "@/bot"

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
	 * The Discord Client
	 * @since 1.15.1
	*/ client,
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

export default class Builder<Excluded extends (keyof Builder)[] = []> {
	protected interval: string = '* * * * *'
	protected listener: (ctx: typeof runContext) => any | Promise<any> = () => undefined

	/**
	 * Set the Interval
	 * @since 1.0.0
	*/ public cron(interval: string): Omit<Builder<[...Excluded, 'cron']>, 'cron' | Excluded[number]> {
		this.interval = interval

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