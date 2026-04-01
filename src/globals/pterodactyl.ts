import env from "@/globals/env"
import { User } from "discord.js"
import axios from "axios"
import { network } from "@rjweb/utils"

/**
 * Format a URL
 * @since 1.15.0
*/ export function url(url: string, ip: network.IPAddress<4>): string{
	return url.replace('{}', ip.rawData[3].toString())
}

/**
 * Test the connection to the Pterodactyl panel
 * @since 1.15.1
*/ export async function testConnection(ip: network.IPAddress<4>): Promise<boolean> {
	try {
		await axios.get(`${url(env.PTERO_URL, ip)}/api/application/servers`, {
			headers: {
				Authorization: `Bearer ${env.PTERO_ADMIN_TOKEN}`,
				Accept: 'application/json'
			}
		})

		return true
	} catch {
		return false
	}
}

/**
 * Create a new User
 * @since 1.1.0
*/ export async function createUser(ip: network.IPAddress<4>, user: User, password: string): Promise<number> {
	const data = await axios.post(`${url(env.PTERO_URL, ip)}/api/application/users`, {
		email: `demo.${user.id}@demo.panel`,
		username: 'demo',
		first_name: 'Demo',
		last_name: user.id,
		root_admin: true,
		password
	}, {
		headers: {
			Authorization: `Bearer ${env.PTERO_ADMIN_TOKEN}`,
			Accept: 'application/json'
		}
	})

	await Promise.all(env.PTERO_DEMO_SERVERS.map((server) => axios.post(`${url(env.PTERO_URL, ip)}/api/client/servers/${server}/users`, {
		email: `demo.${user.id}@demo.panel`,
		permissions: [
			'control.console'
		]
	}, {
		headers: {
			Authorization: `Bearer ${env.PTERO_CLIENT_TOKEN}`,
			Accept: 'application/json'
		}
	})))

	return data.data.attributes.id
}