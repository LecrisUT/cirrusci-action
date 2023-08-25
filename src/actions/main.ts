import { context } from "@actions/github"
import { CirrusCI } from "../CirrusCI"
import { info } from "@actions/core"

async function run(): Promise<void> {
	const client = new CirrusCI(context)
	const result = await client.triggerBuild()
	info(`Build Result ${JSON.stringify(result)}`)
}

run()
