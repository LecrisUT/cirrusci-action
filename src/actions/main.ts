import { context } from "@actions/github"
import { CirrusCIBase } from "../CirrusCIBase"

async function run(): Promise<void> {
	const client = new CirrusCIBase(context)
}

run()
