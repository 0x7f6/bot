import Command from "@/bot/command"
import { number, string, time } from "@rjweb/utils"
import { InteractionContextType, MessageFlags } from "discord.js"
import { eq, and, count } from "drizzle-orm"

export default new Command()
	.build((builder) => builder
		.setName('demo')
		.setContexts(InteractionContextType.Guild)
		.setDescription('Request a demo account')
	)
	.listen(async(ctx) => {
		const demoAccesses = await ctx.database.select({
			id: ctx.database.schema.demoAccesses.id,
			password: ctx.database.schema.demoAccesses.password,
			expired: ctx.database.schema.demoAccesses.expired,
			created: ctx.database.schema.demoAccesses.created
		}).from(ctx.database.schema.demoAccesses)
			.where(eq(ctx.database.schema.demoAccesses.discordId, ctx.interaction.user.id))

		const active = demoAccesses.find((access) => !access.expired)
		if (active) {
			const ip = ctx.proxmox.getIP(active.id)

			return ctx.interaction.reply({
				content: ctx.join(
					'`🔍` You already have an active demo account.',
					`expires <t:${Math.floor((active.created.getTime() + time(1).h()) / 1000)}:R>`,
					'',
					ctx.pterodactyl.url(ctx.env.PTERO_URL, ip),
					ctx.env.PTERO_THEME_URLS ? Object.entries(ctx.env.PTERO_THEME_URLS).map(([ name, url ]) => `[${name} Demo](<${ctx.pterodactyl.url(url, ip)}>)`).join(' | ') : null,
					'```properties',
					'username: demo',
					`password: ${active.password}`,
					'```'
				), flags: [
					MessageFlags.Ephemeral
				]
			})
		}

		if (demoAccesses.some((access) => access.created.getTime() > Date.now() - time(1).d())) return ctx.interaction.reply({
			content: ctx.join(
				'`🔍` You have already requested a demo account in the last 24 hours, please wait or ask in a ticket.',
				`you can request a new one in <t:${Math.floor((demoAccesses.find((access) => access.created.getTime() > Date.now() - time(1).d())!.created.getTime() + time(1).d()) / 1000)}:R>`
			), flags: [
				MessageFlags.Ephemeral
			]
		})

		if (await ctx.database.select({ count: count() }).from(ctx.database.schema.demoAccesses)
			.where(eq(ctx.database.schema.demoAccesses.expired, false)).then((r) => r[0]?.count || 0) >= 4
		) return ctx.interaction.reply({
			content: ctx.join(
				'`🔍` There are no demo accounts available at the moment, please try again later.',
				'You can also ask in a ticket.'
			), flags: [
				MessageFlags.Ephemeral
			]
		})

		const password = string.generate({
			length: 16,
			uppercase: false
		})

		const [[demoAccess]] = await Promise.all([
			ctx.database.insert(ctx.database.schema.demoAccesses)
				.values({
					discordId: ctx.interaction.user.id,
					password
				})
				.returning({ id: ctx.database.schema.demoAccesses.id }),
			ctx.interaction.deferReply({ flags: [MessageFlags.Ephemeral] })
		])

		const ip = ctx.proxmox.getIP(demoAccess.id)

		const mac = Array.from(ctx.env.PROXMOX_NET_MAC)
		mac[5] = 10 + (demoAccess.id % 246)

		const macStr = mac.map((e) => e.toString(16).padStart(2, '0')).join(':')
		const lxcId = 10000 + ip.rawData[3]

		await ctx.proxmox.client.nodes.$(ctx.env.PROXMOX_NODE).lxc.$post({
			vmid: lxcId,
			hostname: `demo-panel-${demoAccess.id}`,
			description: `Demo account for @${ctx.interaction.user.username} (${ctx.interaction.user.id})`,
			ostemplate: ctx.env.PROXMOX_TEMPLATE,
			memory: 6144,
			cores: 2,
			protection: false,
			restore: true,
			start: true,
			storage: ctx.env.PROXMOX_STORAGE,
			net0: `name=eth0,bridge=${ctx.env.PROXMOX_BRIDGE},firewall=1,gw=${ctx.env.PROXMOX_NET_GATEWAY},hwaddr=${macStr},ip=${ip}/${ctx.env.PROXMOX_NET_IP.netmask},type=veth`,
		})

		while (await ctx.proxmox.client.nodes.$(ctx.env.PROXMOX_NODE).lxc.$(lxcId).status.current.$get().then((e) => e.lock)) {
			await time.wait(time(1).s())
		}

		await Promise.all([
			ctx.client.guilds.cache.get(ctx.env.DISCORD_SERVER)!.members.fetch(ctx.interaction.user.id)
				.then((member) => member.roles.add(ctx.env.DEMO_ROLE)),
			ctx.client.guilds.cache.get(ctx.env.DISCORD_SERVER)!.channels.fetch(ctx.env.DEMO_CHANNEL)
				.then((channel) => 'send' in channel! ? channel.send(`\`🔍\` <@${ctx.interaction.user.id}>'s demo access has started, it expires <t:${Math.floor((Date.now() + time(1).h()) / 1000)}:R>`) : null)
		])

		let attempts = 0
		while (attempts > 10) {
			await time.wait(time(1).s())

			try {
				await ctx.pterodactyl.createUser(ip, ctx.interaction.user, password)
				break
			} catch {
				attempts++
			}
		}

		return ctx.interaction.editReply(ctx.join(
			'`🔍` Demo account created.',
			`expires <t:${Math.floor((Date.now() + time(1).h()) / 1000)}:R>`,
			'',
			ctx.pterodactyl.url(ctx.env.PTERO_URL, ip),
			ctx.env.PTERO_THEME_URLS ? Object.entries(ctx.env.PTERO_THEME_URLS).map(([ name, url ]) => `[${name} Demo](<${ctx.pterodactyl.url(url, ip)}>)`).join(' | ') : null,
			'```properties',
			'username: demo',
			`password: ${password}`,
			'```'
		))
	})