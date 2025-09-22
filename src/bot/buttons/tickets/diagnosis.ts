import Button from "@/bot/button"
import ticketsLogModal from "@/bot/modals/tickets/logs"
import { eq } from "drizzle-orm"

export default new Button()
	.setName('ticket-diagnosis')
	.listen(async (ctx, addon: number | null) => {
		const product = !addon ? null : await ctx.database.select({ id: ctx.database.schema.products.id, name: ctx.database.schema.products.name })
			.from(ctx.database.schema.products)
			.where(eq(ctx.database.schema.products.id, addon))
			.limit(1)
			.then((r) => r[0] || null)

		return ctx.interaction.showModal(await ticketsLogModal(ctx.interaction, [], [product]))
	})
	.export()