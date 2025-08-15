import { Client, Message, TextChannel } from "discord.js";
import simpleGit from "simple-git";
import { readFile } from "fs/promises";
import { spawn } from "child_process";
import { rmSync } from "fs";
import { writeFile } from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const CATEGORY_ID = "1399798485854715914";
const CLAIMED_CATEGORY_ID = "1399798780282540383";
const ADMIN_CHANNEL = "1396888081621057636";

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

async function checkOverlayTicket(msg: Message) {
	if(msg.author.bot) return; // Ignore bot messages
	if(!(msg.channel instanceof TextChannel)) return;

	const messages = await msg.channel.messages.fetch({ limit: 100 });
	
	if(messages.size === 3) {
		const adminChannel = bot.channels.cache.get(ADMIN_CHANNEL);
		if(adminChannel && adminChannel instanceof TextChannel) {
			adminChannel.send(`Neues Overlay Ticket in <#${msg.channel.id}> <@1399472653605015552>`);
		}
	}

	const hasAlliance = messages.some(m => m.content.toLowerCase().includes("alliance")) || messages.some(m => m.content.toLowerCase().includes("allianz"));
	if(hasAlliance) return;

	// Check if this channel has any message with a wplace.live link
	const hasWplaceLiveLink = messages.some(m => m.content.includes("wplace.live"));
	if(!hasWplaceLiveLink) {
		msg.reply("🇩🇪 Bitte sende einen Link zum Ort deines Artworks über den Share Knopf auf Wplace.\n🇺🇸 Please send a link to the location of your artwork using the share button in Wplace.");
	}

	const hasArtworkIgnore = messages.some(m => m.content.includes("!artignore"));
	// If the message has an image attachment, check its dimensions
	if(msg.attachments.size > 0) {
		const attachment = msg.attachments.first();
		if(attachment && attachment.height && attachment.width) {
			if(attachment.height > 500 || attachment.width > 500) {

				// Check all previous messages in the channel, if there already is a pixel art image, do not reply
				msg.channel.messages.fetch({ limit: 100 }).then(messages => {
					const hasPixelArt = messages.some(m => {
						const attachment = m.attachments.first();
						if(!attachment) return false;
						if(!attachment.height || !attachment.width) return false;
						return attachment.height <= 500 && attachment.width <= 500;
					});
					if(hasPixelArt) return;

					msg.reply("🇩🇪 Bitte stelle sicher, dass dein Bild auch ein Pixel Art ist (sonst wird es riesig auf dem Canvas) und die Wplace Farben hat. Du kannst dein Bild in <#1398386803790188684> verpixeln lassen.\n🇺🇸 Please ensure that your image is a pixel art (otherwise it would be huge on the canvas) and has the Wplace colors. You can automatically create pixel art in <#1398386803790188684>.");
				}).catch(console.error);
			} else {
				// If the image is within the limits, do nothing
				return;
			}
		}
	}
}

bot.on("messageCreate", async (msg) => {
	// If the channel is in either categories, call a new function
	if(!(msg.channel instanceof TextChannel)) return;
	if(msg.channel.parentId === CATEGORY_ID || msg.channel.parentId === CLAIMED_CATEGORY_ID) {
		return void checkOverlayTicket(msg);
	}
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
