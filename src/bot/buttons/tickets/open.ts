import Button from "@/bot/button"
import { ActionRowBuilder, MessageFlags } from "discord.js"
import softwareSelect from "@/bot/selects/tickets/software"

export default new Button()
	.setName('ticket-open')
	.listen(async(ctx) => {
		return ctx.interaction.reply({
			content: "### PLEASE READ EVERYTHING, YOU ARE MISSING IMPORTANT DETAILS.",
			embeds: [
				ctx.Embed()
					.setTitle('`⚒️` Open Ticket')
					.setDescription(ctx.join(
						'> Before we open a ticket, we will ask you some questions in hopes of you finding the solution to your problem.',
						'',
						'Please select the software you are having issues with.'
					))
			], components: [
				new ActionRowBuilder()
					.addComponents(
						softwareSelect(ctx, [], [])
					) as any
			], flags: [
				MessageFlags.Ephemeral
			]
		})
	})
	.export()
