import "@/instrument"
import * as Sentry from "@sentry/node"
import { system, filesystem } from "@rjweb/utils"
import * as fs from "fs"
import path from "path"
import Crontab, { CrontabOverlapError, runContext } from "@/crontab"
import cron from "node-cron"
import env from "@/globals/env"
import logger from "@/globals/logger"

export default function getVersion() {
	return `${JSON.parse(fs.readFileSync('../package.json', 'utf8')).version}:${system.execute('git rev-parse --short=10 HEAD').trim()}`
}

Promise.all([ ...filesystem.getFiles(`${__dirname}/crontabs`, { recursive: true }).filter((file) => file.endsWith('js')).map(async(file) => {
	const cronFile = (await import(file)).default.default

	if (cronFile instanceof Crontab) {
		const interval = cronFile['interval'],
			hasSeconds = interval.trim().split(/\s+/).length === 6,
			monitorConfig: NonNullable<Parameters<typeof Sentry.captureCheckIn>[1]> = {
				schedule: hasSeconds
					? { type: 'interval', value: 1, unit: 'minute' }
					: { type: 'crontab', value: interval },
				checkinMargin: cronFile['monitorOptions'].checkinMargin ?? 2,
				maxRuntime: cronFile['monitorOptions'].maxRuntime ?? 5,
				timezone: 'UTC'
			}

		const name = path.relative(`${__dirname}/crontabs`, file)

		let lastMonitoredMinute = -1,
			runningSince: number | null = null,
			runningSlug: string | null = null,
			overlapSkips = 0

		cron.schedule(interval, async() => {
			if (!cronFile['condition'](runContext)) return

			if (runningSince !== null) {
				overlapSkips++

				if (overlapSkips === 3) {
					Sentry.withScope((scope) => {
						scope
							.setFingerprint([ 'crontab-overlap', name ])
							.setTag('crontab', name)
							.setExtras({
								interval, skips: overlapSkips,
								runningForMs: Date.now() - runningSince!,
								monitorSlug: runningSlug
							})

						if (runningSlug) scope.setTag('monitor', runningSlug)

						Sentry.captureException(new CrontabOverlapError(`Crontab ${name} skipped ${overlapSkips} ticks in a row because the previous run is still going`))
					})

					logger()
						.text('Crontab Overlap')
						.text(name, (c) => c.cyan)
						.text(`skipped ${overlapSkips} ticks, previous run still going`, (c) => c.red)
						.error()
				}

				return
			}

			runningSince = Date.now()
			runningSlug = null
			overlapSkips = 0

			let checkIn: { slug: string, id: string, start: number } | null = null
			try {
				if (cronFile['monitorSlug']) {
					const minute = Math.floor(Date.now() / 60000)

					if (!hasSeconds || minute !== lastMonitoredMinute) {
						lastMonitoredMinute = minute

						const slug = runningSlug = cronFile['monitorSlug'](runContext)
						checkIn = {
							slug, start: Date.now(),
							id: Sentry.captureCheckIn({ monitorSlug: slug, status: 'in_progress' }, monitorConfig)
						}
					}
				}

				if (checkIn) await Sentry.startSpan({ name: `cron ${checkIn.slug}`, op: 'cron', forceTransaction: true }, () => cronFile['listener'](runContext))
				else await Promise.resolve(cronFile['listener'](runContext))

				if (checkIn) Sentry.captureCheckIn({
					checkInId: checkIn.id, monitorSlug: checkIn.slug, status: 'ok',
					duration: (Date.now() - checkIn.start) / 1000
				}, monitorConfig)
			} catch (error: any) {
				if (checkIn) Sentry.captureCheckIn({
					checkInId: checkIn.id, monitorSlug: checkIn.slug, status: 'error',
					duration: (Date.now() - checkIn.start) / 1000
				}, monitorConfig)

				Sentry.captureException(error)

				logger()
					.text('Crontab Error')
					.text('\n')
					.text(error.stack ?? error.toString(), (c) => c.red)
					.error()
			} finally {
				runningSince = null
			}
		}, {
			timezone: 'UTC'
		})
	}
}) ]).then(() => {
	if (env.PORT) require('@/api')
	require('@/bot')
})