import Button from "@/bot/button"
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from "discord.js"
import { and, eq, isNull } from "drizzle-orm"
import closeTicket from "@/bot/buttons/tickets/close"

export default new Button()
	.setName('ticket-force-open')
	.listen(async (ctx, rawData: number[], logs: string) => {
		const data = ctx.support.expandData(rawData)

		const existingTicket = await ctx.database.select({
			channelId: ctx.database.schema.tickets.channelId
		})
			.from(ctx.database.schema.tickets)
			.where(and(
				eq(ctx.database.schema.tickets.discordId, ctx.interaction.user.id),
				isNull(ctx.database.schema.tickets.closed)
			))
			.then((r) => r[0])

		if (existingTicket) return ctx.interaction.update({
			embeds: [
				ctx.Embed()
					.setTitle('`⚒️` Open Ticket')
					.setDescription(ctx.join(
						'You already have an open ticket.',
						'',
						'> **Solution**',
						`> View the ticket at <#${existingTicket.channelId}>.`
					))
			], components: [
				new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setLabel('Open Ticket')
							.setStyle(ButtonStyle.Primary)
							.setEmoji('1150889684227076227')
							.setCustomId('ticket-force-open-fake')
							.setDisabled(true)
					) as any
			]
		})

		await ctx.interaction.update({
			components: [
				new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setLabel('Open Ticket')
							.setStyle(ButtonStyle.Primary)
							.setEmoji('1154135013948915793')
							.setCustomId('ticket-force-open-fake')
							.setDisabled(true)
					) as any
			]
		})

		if (data.addon) {
			const addon = await ctx.database.select({ name: ctx.database.schema.products.name })
				.from(ctx.database.schema.products)
				.where(eq(ctx.database.schema.products.id, parseInt(data.addon)))
				.limit(1)
				.then((r) => r[0])

			data.addon = addon.name
		}

		if (logs) data.logs = `https://pastes.dev/${logs}`

		const ticket = await ctx.database.insert(ctx.database.schema.tickets)
			.values({
				discordId: ctx.interaction.user.id,
				channelId: '0',
				notes: Object.entries(data).map(([key, value]) => `${key}: ${value}`).join('\n'),
				users: []
			})
			.returning({ id: ctx.database.schema.tickets.id, notes: ctx.database.schema.tickets.notes })
			.then((r) => r[0])

		try {
			const channel = await ctx.interaction.guild?.channels.create({
				name: `ticket-${ctx.interaction.user.username}`,
				type: ChannelType.GuildText,
				parent: ctx.env.TICKET_CATEGORY,
				permissionOverwrites: [
					{
						id: ctx.interaction.guildId!,
						deny: [PermissionFlagsBits.ViewChannel]
					},
					{
						id: ctx.interaction.user.id,
						allow: [PermissionFlagsBits.ViewChannel]
					},
					{
						id: ctx.env.SUPPORT_ROLE,
						allow: [PermissionFlagsBits.ViewChannel]
					}
				]
			})

			if (!channel) return ctx.interaction.editReply({
				embeds: [
					ctx.Embed()
						.setTitle('`⚒️` Open Ticket')
						.setDescription(ctx.join(
							'An error occurred while opening your ticket.',
							'',
							'> **Error**',
							'> An error occurred while creating the ticket channel.'
						))
				], components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setLabel('Open Ticket')
								.setStyle(ButtonStyle.Primary)
								.setEmoji('1150889684227076227')
								.setCustomId('ticket-force-open-fake')
								.setDisabled(true)
						) as any
				]
			})

			await ctx.database.update(ctx.database.schema.tickets)
				.set({ channelId: channel.id })
				.where(eq(ctx.database.schema.tickets.id, ticket.id))

			const intitialMessage = await channel.send({
				content: `<@${ctx.interaction.user.id}> <@&${ctx.env.SUPPORT_ROLE}>`,
				embeds: [
					ctx.Embed()
						.setTitle('`⚒️` Ticket Opened')
						.setThumbnail(ctx.interaction.user.displayAvatarURL())
						.setDescription(ctx.join(
							'Your Ticket has been opened successfully.',
							'',
							'> **Notes**',
							'```properties',
							ticket.notes,
							'```'
						))
				], components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setLabel('Close Ticket')
								.setStyle(ButtonStyle.Danger)
								.setEmoji('1150889684227076227')
								.setCustomId(closeTicket(ctx.interaction))
						) as any
				]
			})

			await intitialMessage.pin().catch(() => null)

			return ctx.interaction.editReply({
				embeds: [
					ctx.Embed()
						.setTitle('`⚒️` Open Ticket')
						.setDescription(ctx.join(
							'Your Ticket has been successfully opened.',
							'',
							'> **Channel**',
							`> ${channel.url}`
						))
				], components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setLabel('Open Ticket')
								.setStyle(ButtonStyle.Primary)
								.setEmoji('1150889684227076227')
								.setCustomId('ticket-force-open-fake')
								.setDisabled(true)
						) as any
				]
			})
		} catch (err: any) {
			ctx.logger()
				.text('Ticket Open', (c) => c.redBright)
				.text('failed')
				.text('\n')
				.text(err.stack!, (c) => c.red)
				.error()

			await ctx.database.delete(ctx.database.schema.tickets)
				.where(eq(ctx.database.schema.tickets.id, ticket.id))

			return ctx.interaction.editReply({
				embeds: [
					ctx.Embed()
						.setTitle('`⚒️` Open Ticket')
						.setDescription(ctx.join(
							'An error occurred while opening your ticket.',
							'',
							'> **Error**',
							'> An error occurred while creating the ticket channel.'
						))
				], components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setLabel('Open Ticket')
								.setStyle(ButtonStyle.Primary)
								.setEmoji('1150889684227076227')
								.setCustomId('ticket-force-open-fake')
								.setDisabled(true)
						) as any
				]
			})
		}
	})
	.export()