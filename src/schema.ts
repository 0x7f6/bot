import { sql } from "drizzle-orm"
import { boolean, char, decimal, text, integer, pgEnum, pgTable, serial, timestamp, time, uniqueIndex, varchar, index, jsonb, uuid, smallint, smallserial } from "drizzle-orm/pg-core"

export const productProvider = pgEnum('productProvider', ['SOURCEXCHANGE', 'BUILTBYBIT'])
export const currency = pgEnum('currency', ['EUR', 'USD'])

export const products = pgTable('products', {
	id: serial('id').primaryKey(),

	name: varchar('name', { length: 51 }).notNull(),
	icon: varchar('icon', { length: 255 }).notNull(),
	banner: varchar('banner', { length: 255 }).notNull(),
	summary: varchar('summary', { length: 255 }).notNull(),
	version: varchar('version', { length: 51 }).default('1.0.0').notNull(),
	identifier: varchar('identifier', { length: 51 }).notNull().default(sql`gen_random_uuid()`),

	role: varchar('role', { length: 22 }).notNull(),
}, (products) => [
	uniqueIndex('products_name_idx').on(products.name),
	uniqueIndex('products_identifier_idx').on(products.identifier),
	uniqueIndex('products_role_idx').on(products.role)
])

export const productProviders = pgTable('product_providers', {
	id: serial('id').primaryKey(),
	productId: integer('productId').references(() => products.id).notNull(),

	provider: productProvider('provider').notNull(),
	productProviderId: integer('productProviderId').notNull(),

	link: varchar('link', { length: 255 }).notNull(),
	price: decimal('price', { precision: 10, scale: 2 }).notNull(),
	currency: currency('currency').notNull()
}, (productProviders) => [
	uniqueIndex('productProviders_productId_provider_idx').on(productProviders.productId, productProviders.provider)
])

export const productChangelogs = pgTable('product_changelogs', {
	productId: integer('productId').references(() => products.id).notNull(),
	version: varchar('version', { length: 51 }).notNull(),

	content: text('content').notNull(),

	created: timestamp('created').default(sql`now()`).notNull()
}, (productChangelogs) => [
	uniqueIndex('productChangelogs_productId_version_idx').on(productChangelogs.productId, productChangelogs.version),
	index('productChangelogs_productId_idx').on(productChangelogs.productId),
	index('productChangelogs_created_idx').on(productChangelogs.created)
])

export const productLinks = pgTable('product_links', {
	id: serial('id').primaryKey(),
	productId: integer('productId').references(() => products.id).notNull(),
	providerId: integer('providerId').references(() => productProviders.id).notNull(),

	discordId: varchar('discordId', { length: 22 }).notNull(),
	paymentId: varchar('paymentId', { length: 51 }).notNull(),

	created: timestamp('created').default(sql`now()`).notNull()
}, (productLinks) => [
	uniqueIndex('productLinks_paymentId_idx').on(productLinks.paymentId),
	uniqueIndex('productLinks_discordId_productId_providerId_idx').on(productLinks.discordId, productLinks.productId, productLinks.providerId)
])

export const demoAccesses = pgTable('demo_accesses', {
	id: serial('id').primaryKey(),

	expired: boolean('expired').default(false).notNull(),
	password: char('password', { length: 16 }).notNull(),
	discordId: varchar('discordId', { length: 22 }).notNull(),

	created: timestamp('created').default(sql`now()`).notNull()
}, (demoAccesses) => [
	index('demoAccesses_discordId_idx').on(demoAccesses.discordId),
	index('demoAccesses_expired_idx').on(demoAccesses.expired),
	index('demoAccesses_created_idx').on(demoAccesses.created)
])

export const sendMessages = pgTable('send_messages', {
	id: serial('id').primaryKey(),

	enabled: boolean('enabled').default(true).notNull(),
	sticky: boolean('sticky').default(false).notNull(),

	discordId: varchar('discordId', { length: 22 }),
	discordChannelId: varchar('discordChannelId', { length: 22 }).notNull(),
	message: text('message').notNull(),
	icon: varchar('icon', { length: 255 }),
	image: varchar('image', { length: 255 }),

	ticket: boolean('ticket').default(false).notNull(),

	updated: timestamp('updated').default(sql`now()`).notNull(),
}, (sendMessages) => [
	uniqueIndex('sendMessages_discordChannelId_discordId_idx')
		.on(sendMessages.discordChannelId, sendMessages.discordId)
])

export const faqs = pgTable('faqs', {
	id: serial('id').primaryKey(),

	title: varchar('title', { length: 31 }).notNull(),
	content: text('content').notNull(),

	created: timestamp('created').default(sql`now()`).notNull(),
	updated: timestamp('updated').default(sql`now()`).notNull()
}, (faqs) => [
	uniqueIndex('faqs_title_idx').on(faqs.title),
	index('faqs_created_idx').on(faqs.created),
	index('faqs_updated_idx').on(faqs.updated)
])

export const adventCalendarDays = pgTable('advent_calendar_days', {
	id: smallserial('id').primaryKey(),

	year: smallint('year').notNull(),
	day: smallint('day').notNull(),
	content: text('content').notNull(),

	maxRedeems: smallint('maxRedeems'),

	created: timestamp('created').default(sql`now()`).notNull(),
	after: time('after')
}, (calendarDays) => [
	uniqueIndex('adventCalendarDays_year_day_idx').on(calendarDays.year, calendarDays.day),
	index('adventCalendarDays_created_idx').on(calendarDays.created)
])

export const adventCalendarRedeems = pgTable('advent_calendar_redeems', {
	calendarDayId: integer('calendarDayId').references(() => adventCalendarDays.id).notNull(),
	discordId: varchar('discordId', { length: 22 }).notNull(),

	created: timestamp('created').default(sql`now()`).notNull()
}, (redeems) => [
	uniqueIndex('adventCalendarRedeems_calendarDayId_discordId_idx').on(redeems.calendarDayId, redeems.discordId),
	index('adventCalendarRedeems_created_idx').on(redeems.created)
])

export const automaticErrors = pgTable('automatic_errors', {
	id: serial('id').primaryKey(),

	allowedRegex: varchar('allowed_regex', { length: 255 }).notNull(),
	disallowedRegex: varchar('disallowed_regex', { length: 255 }),

	enabled: boolean('enabled').default(true).notNull(),
	content: text('content').notNull(),

	created: timestamp('created').default(sql`now()`).notNull()
}, (errors) => [
	uniqueIndex('automaticErrors_allowedRegex_idx').on(errors.allowedRegex),
	index('automaticErrors_created_idx').on(errors.created)
])

export const supportDataPoints = pgTable('support_data_points', {
	id: serial('id').primaryKey(),
	key: varchar('key', { length: 100 }).notNull().unique(),
	question: text('question').notNull(),
	priority: integer('priority').notNull(),
	possibleValues: jsonb('possible_values').$type<string[]>().notNull()
})

export const supportMatchers = pgTable('support_matchers', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 200 }).notNull(),
	conditions: jsonb('conditions').$type<Record<string, string[]>>().notNull(),
	solution: text('solution').notNull(),
	priority: integer('priority').default(100).notNull()
})

export const tickets = pgTable('tickets', {
	id: serial('id').primaryKey(),
	discordId: varchar('discordId', { length: 22 }).notNull(),
	channelId: varchar('channelId', { length: 22 }).notNull(),

	transcript: varchar('transcript', { length: 255 }),
	users: varchar('users', { length: 22 }).array().notNull().default([]),
	notes: text('notes').notNull(),

	closed: timestamp('closed'),
	created: timestamp('created').default(sql`now()`).notNull()
}, (tickets) => [
	uniqueIndex('tickets_channelId_idx').on(tickets.channelId),
	index('tickets_discordId_idx').on(tickets.discordId)
])