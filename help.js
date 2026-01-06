// commands/slash/help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("View all bot commands and their descriptions."),

  async execute(interaction) {
    const purple = 0x9b59ff;

    const embed = new EmbedBuilder()
      .setColor(purple)
      .setTitle("📘 Generator Bot — Help Menu")
      .setDescription("Here is the full list of available commands:")
      .addFields(
        {
          name: "🎁 Generator Commands",
          value:
            "➡ `/gen service:` — Generate an account.\n" +
            "➡ `/stock` — Show full stock.\n" +
            "➡ `/stock service:` — Show stock for a specific service.",
        },
        {
          name: "🛠 Admin Commands",
          value:
            "➡ `/add service: accounts:` — Add accounts to stock.\n" +
            "➡ `/backupstock` — Download a full backup of the generator stock.",
        },
        {
          name: "📄 Information",
          value: "➡ `/help` — Shows this help menu.",
        }
      )
      .setFooter({ text: "Powered by Codura" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
