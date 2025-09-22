import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, APIActionRowComponent } from "discord.js"
import { client } from "@/bot"
import getVersion from "@/index"
import database from "@/globals/database"
import env from "@/globals/env"
import cache from "@/globals/cache"
import * as sourcexchange from "@/globals/sourcexchange"
import * as builtbybit from "@/globals/builtbybit"
import * as pterodactyl from "@/globals/pterodactyl"
import * as support from "@/globals/support"
import * as proxmox from "@/globals/proxmox"
import s3 from "@/globals/s3"
import { Scope } from "@sentry/node"
import logger from "@/globals/logger"
import CustomEmbed from "@/bot/classes/CustomEmbed"
import { PaginateType } from "@/bot/button"

type PromiseOrNot<T> = T | Promise<T>

const version = getVersion()

export default class Context<Interaction extends any> {
	protected startTime!: number

	/**
	 * Construct a new Context
	 * @since 1.0.0
	*/ constructor(interaction: Interaction, scope: Scope) {
		this.interaction = interaction
		this.scope = scope
	}

	/**
	 * Create Multi Line Strings
	 * @since 1.0.0
	*/ public join(...strings: (string | number | undefined | null | boolean)[]): string {
		return strings.filter((str) => str === '' || Boolean(str)).join('\n')
	}

	/**
	 * Create an Embed with default settings
	 * @since 1.0.0
	*/ public Embed() {
		return new CustomEmbed(performance.now() - this.startTime)
	}

	/**
	 * Get pagination data
	 * @since 1.0.0
	*/ public async paginate<Data extends any[]>(page: number, direction: PaginateType, count: PromiseOrNot<number>, data: (meta: { take: number, skip: number }) => PromiseOrNot<Data>, itemsPerPage = 10): Promise<[page: number, count: number, data: Data]> {
		if (page < 2 && direction === 'back') page = 1

		page = direction === 'first'
			? 1
			: direction === 'back'
				? page - 1
				: direction === 'next'
					? page + 1
					: page

		const c = await Promise.resolve(count)
		if (direction === 'last') page = Math.ceil((c || 1) / itemsPerPage)
		else page = page > Math.ceil((c || 1) / itemsPerPage) ? Math.ceil((c || 1) / itemsPerPage) : page

		return [page, c, await Promise.resolve(data({ take: itemsPerPage, skip: (page - 1) * itemsPerPage }))]
	}

	/**
	 * Get pagination buttons
	 * @since 1.0.0
	*/ public paginateButtons(page: number, count: number, button: (type: PaginateType) => string, itemsPerPage = 10): [APIActionRowComponent<any>, APIActionRowComponent<any>] {
		return [
			new ActionRowBuilder()
				.setComponents(
					new ButtonBuilder()
						.setEmoji('1150889388834820249')
						.setStyle(ButtonStyle.Primary)
						.setCustomId(button('refresh')),
					new ButtonBuilder()
						.setEmoji('1150889245603528764')
						.setDisabled(page === 1)
						.setStyle(ButtonStyle.Primary)
						.setCustomId(button('back')),
					new ButtonBuilder()
						.setLabel(page.toString())
						.setDisabled(true)
						.setStyle(ButtonStyle.Secondary)
						.setCustomId('e'),
					new ButtonBuilder()
						.setEmoji('1150889195057991732')
						.setDisabled(page >= Math.ceil(count / itemsPerPage))
						.setStyle(ButtonStyle.Primary)
						.setCustomId(button('next'))
				),
			new ActionRowBuilder()
				.setComponents(
					new ButtonBuilder()
						.setEmoji('1150889245603528764')
						.setLabel('First Page')
						.setStyle(ButtonStyle.Primary)
						.setDisabled(page === 1)
						.setCustomId(button('first')),
					new ButtonBuilder()
						.setEmoji('1150889195057991732')
						.setLabel('Last Page')
						.setStyle(ButtonStyle.Primary)
						.setDisabled(page >= Math.ceil(count / itemsPerPage))
						.setCustomId(button('last'))
				)
		] as any
	}

	/**
	 * The Interaction related to this Event
	 * @since 1.0.0
	*/ public interaction: Interaction
	/**
	 * The DiscordJS Client
	 * @since 1.0.0
	*/ public client = client as Client<true>
	/**
	 * The Environment Variables of the Server
	 * @since 1.0.0
	*/ public env = env
	/**
	 * The Prisma Database Connection
	 * @since 1.0.0
	*/ public database = database
	/**
	 * The Cache Helper
	 * @since 1.13.0
	*/ public cache = cache
	/**
	 * The Logger Helper
	 * @since 1.0.0
	*/ public logger = logger
	/**
	 * The Proxmox API Client
	 * @since 1.15.0
	*/ public proxmox = proxmox
	/**
	 * The SourceXchange API Client
	 * @since 1.0.0
	*/ public sourcexchange = sourcexchange
	/**
	 * The BuiltByBit API Client
	 * @since 1.3.0
	*/ public builtbybit = builtbybit
	/**
	 * The Pterodactyl API Client
	 * @since 1.1.0
	*/ public pterodactyl = pterodactyl
	/**
	 * Support Utilities
	 * @since 1.12.0
	*/ public support = support
	/**
	 * The S3 Client
	 * @since 1.12.0
	*/ public s3 = s3
	/**
	 * The Sentry Scope
	 * @since 1.0.0
	*/ public scope: Scope

	/**
	 * The App Version
	 * @since 1.0.0
	*/ public appVersion = version
}