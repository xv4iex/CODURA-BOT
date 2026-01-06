// deploy-commands.js
require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");

const commands = [];
const slashPath = "./commands/slash";
const slashFiles = fs.readdirSync(slashPath).filter(f => f.endsWith(".js"));

for (const file of slashFiles) {
  const command = require(`${slashPath}/${file}`);
  if (!command.data?.toJSON) {
    console.log(`❗ Skipping ${file}: it does not export .data.toJSON()`);
    continue;
  }
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 Registering global slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Commands registered globally.");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
})();
