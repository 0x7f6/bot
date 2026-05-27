import Select from "@/bot/select"
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js"
import { eq } from "drizzle-orm"
import productSelect from "@/bot/selects/tickets/product"

export default new Select()
	.setName('ticket-software')
	.setPlaceholder('Select the software you are using')
	.build((builder) => {
		builder.addOption((option) => option
			.setLabel('Pterodactyl')
			.setValue('PTERODACTYL')
		)

		builder.addOption((option) => option
			.setLabel('Calagopus')
			.setValue('CALAGOPUS')
		)

		builder.addOption((option) => option
			.setLabel('Other')
			.setValue('other')
		)

		return builder
	})
	.listen(async(ctx) => {
		const software = ctx.interaction.values[0]

		const initialData = (software === 'PTERODACTYL' || software === 'CALAGOPUS')
			? ctx.support.compactData({ software })
			: []

		const products = await ctx.database.select({
			name: ctx.database.schema.products.name,
			identifier: ctx.database.schema.products.identifier
		})
			.from(ctx.database.schema.products)
			.where(software !== 'other' ? eq(ctx.database.schema.products.software, software as typeof ctx.database.schema.productSoftware.enumValues[number]) : undefined)

		return ctx.interaction.update({
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
						productSelect(ctx, [products], [initialData])
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
			]
		})
	})
	.export()
