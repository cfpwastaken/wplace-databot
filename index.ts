import { Client } from "discord.js";
import simpleGit from "simple-git";
import { readFile } from "fs/promises";
import { spawn } from "child_process";
import { rmSync } from "fs";
import { writeFile } from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const bot = new Client({
	intents: [
		"Guilds",
		"GuildMessages",
		"MessageContent"
	]
})

bot.on("ready", () => {
	console.log(`Logged in as ${bot.user?.tag}!`);
});

function runCommand(cmd: string, args: string[] = [], options: any = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', ...options });

    proc.on('close', (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(`Process exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}

bot.on("messageCreate", async (msg) => {
	if(msg.channel.id !== CHANNEL_ID) {
		return;
	}
	const HOS_NUMBER = /#(\d+)/g;
	const matches = msg.content.match(HOS_NUMBER);
	if(matches) {
		await simpleGit().clone("git+ssh://git@github.com/cfpwastaken/wplace-hallofshame.git", "hallofshame", ["--depth", "1"]);
		const git = simpleGit("hallofshame");
		const hos = JSON.parse(await readFile("hallofshame/hallofshame.json", "utf-8"));

		for(const match of matches) {
			const number = parseInt(match.replace("#", ""));

			if(isNaN(number) || hos.includes(number)) {
				continue; // Skip if not a number or already in the hall of shame
			}

			hos.push(number);
		}

		await writeFile("hallofshame/hallofshame.json", JSON.stringify(hos, null, 2), "utf-8");

		await git.add("./hallofshame.json");
		await git.addConfig("user.name", "Wplace DE Bot");
		await git.addConfig("user.email", "wplace@example.com");
		await git.commit("hos: new entries from discord");
		await git.push("origin", "main");

		await runCommand("bun", ["install"], {
			cwd: "hallofshame"
		});
		await runCommand("bun", ["run", "index.ts"], {
			cwd: "hallofshame"
		});
		rmSync("hallofshame", { recursive: true, force: true });
		console.log(`Processed message: ${msg.content}`);
	}
})

bot.login(TOKEN).catch(console.error);
