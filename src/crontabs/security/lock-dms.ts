import Crontab from "@/crontab"

import { Guild } from "discord.js"

import logger from "@/globals/logger"
import env from "@/globals/env"

export default new Crontab()
	.cron("0 0 * * *")
	.listen(async (ctx) => {
		const guild = await ctx.client.guilds.fetch(env.DISCORD_SERVER).catch(() => null)
		if (!guild) {
			logger().text(`Unable to fetch guild ${env.DISCORD_SERVER}`).info()
			return
		}
		try {
			const until = new Date(Date.now() + 24 * 60 * 60 * 1000),
				options: any = {
					dmsDisabledUntil: until,
				}
			await (guild as Guild).setIncidentActions(options)
			logger().text(`Updated incident actions (dmsDisabledUntil) via guild.setIncidentActions for ${env.DISCORD_SERVER}`).info()
		} catch (err) {
			logger().text(`Failed to update incident actions for ${env.DISCORD_SERVER}: ${String(err)}`).error()
		}
	})