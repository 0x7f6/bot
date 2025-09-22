import Button from "@/bot/button"
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js"
import productSelect from "@/bot/selects/tickets/product"

export default new Button()
	.setName('ticket-open')
	.listen(async (ctx) => {
		const products = await ctx.database.select({
			name: ctx.database.schema.products.name,
			identifier: ctx.database.schema.products.identifier
		})
			.from(ctx.database.schema.products)

		return ctx.interaction.reply({
			content: "### PLEASE READ EVERYTHING, YOU ARE MISSING IMPORTANT DETAILS.",
			embeds: [
				ctx.Embed()
					.setTitle('`⚒️` Open Ticket')
					.setDescription(ctx.join(
						'> Before we open a ticket, we will ask you some questions in hopes of you finding the solution to your problem.',
						'',
						'Please select the product you are having issues with. (If any)'
					))
			], components: [
				new ActionRowBuilder()
					.addComponents(
						productSelect(ctx, [products], [])
					) as any,
				new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setLabel('Self-Diagnosis')
							.setStyle(ButtonStyle.Primary)
							.setEmoji('1150889684227076227')
							.setDisabled(true)
							.setCustomId('ticket-diagnosis-fake')
					) as any
			], flags: [
				MessageFlags.Ephemeral
			]
		})
	})
	.export()
