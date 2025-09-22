import Button, { Exported, PaginateType } from "@/bot/button"
import { count, eq } from "drizzle-orm"

const button: Exported<[user: string | null, current: number, type: PaginateType]> = new Button()
	.setName('products')
	.listen(async (ctx, user: string | null, current: number, type: PaginateType) => {
		switch (user) {
			case null: {
				const [page, total, data] = await ctx.paginate(current, type, ctx.database.select({
					count: count(ctx.database.schema.products.id)
				}).from(ctx.database.schema.products).then((r) => r[0].count),
					({ skip, take }) => ctx.database.select({
						name: ctx.database.schema.products.name,
						icon: ctx.database.schema.products.icon,
						banner: ctx.database.schema.products.banner,
						summary: ctx.database.schema.products.summary,
						version: ctx.database.schema.products.version,
						provider: ctx.database.schema.productProviders.provider,
						price: ctx.database.schema.productProviders.price,
						currency: ctx.database.schema.productProviders.currency,
						link: ctx.database.schema.productProviders.link
					}).from(ctx.database.schema.products)
						.leftJoin(ctx.database.schema.productProviders, eq(ctx.database.schema.products.id, ctx.database.schema.productProviders.productId))
						.orderBy(ctx.database.schema.products.id)
						.offset(skip * ctx.database.schema.productProvider.enumValues.length)
						.limit(take * ctx.database.schema.productProvider.enumValues.length),
					1
				)

				return ctx.interaction.update({
					embeds: [
						ctx.Embed()
							.setTitle(ctx.interaction.message.embeds[0].title)
							.setImage(data[0].banner)
							.setThumbnail(data[0].icon)
							.setDescription(ctx.join(
								`## ${data[0].name}`,
								`> \`${data[0].version}\` ${data[0].summary}`,
								'',
								'**Purchase**',
								...data.filter((product) => product.name === data[0].name).map((product) =>
									`[${ctx.database.properCaseProvider(product.provider!)}](<${product.link}>) - \`${parseFloat(product.price!).toFixed(2)} ${product.currency}\``
								)
							))
							.setFooter({ text: `${total} Products` })
					], components: ctx.paginateButtons(page, total, (type) => button(ctx.interaction, null, page, type), 1)
				})
			}

			default: {
				const [page, total, data] = await ctx.paginate(current, type, ctx.database.selectDistinct({
					count: count(ctx.database.schema.products.id)
				}).from(ctx.database.schema.products)
					.leftJoin(ctx.database.schema.productLinks, eq(ctx.database.schema.products.id, ctx.database.schema.productLinks.productId))
					.where(eq(ctx.database.schema.productLinks.discordId, user))
					.then((r) => r[0].count),
					({ skip, take }) => ctx.database.selectDistinct({
						id: ctx.database.schema.products.id,
						name: ctx.database.schema.products.name,
						icon: ctx.database.schema.products.icon,
						banner: ctx.database.schema.products.banner,
						summary: ctx.database.schema.products.summary,
						version: ctx.database.schema.products.version
					}).from(ctx.database.schema.products)
						.leftJoin(ctx.database.schema.productLinks, eq(ctx.database.schema.products.id, ctx.database.schema.productLinks.productId))
						.where(eq(ctx.database.schema.productLinks.discordId, user))
						.orderBy(ctx.database.schema.products.id)
						.offset(skip)
						.limit(take),
					1
				)

				return ctx.interaction.update({
					embeds: [
						ctx.Embed()
							.setTitle(ctx.interaction.message.embeds[0].title)
							.setImage(data[0].banner)
							.setThumbnail(data[0].icon)
							.setDescription(ctx.join(
								`## ${data[0].name}`,
								`> \`${data[0].version}\` ${data[0].summary}`
							))
							.setFooter({ text: `${total} Products` })
					], components: ctx.paginateButtons(page, total, (type) => button(ctx.interaction, user, page, type), 1)
				})
			}
		}
	})
	.export()

export default button