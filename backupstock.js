// commands/slash/backupstock.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("backupstock")
    .setDescription("Download a full backup of the generator stock."),

  async execute(interaction) {
    const purple = 0x9b59ff;
    const logChannelId = "1440118861083971736";
    const adminRoleId = "1440108012176933116"; // ROLE ADMIN

    try {
      await interaction.deferReply({ ephemeral: true });

      // ✔ FIX PERMISOS (Ahora valida rol)
      if (!interaction.member.roles.cache.has(adminRoleId)) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("⛔ Access Denied")
              .setDescription("You do not have permission to use this command.")
              .setTimestamp()
          ]
        });
      }

      const stock = interaction.client.serviceStock;
      if (!stock)
        throw new Error("Stock object not initialized!");

      const roblox = stock.roblox || [];
      const epic = stock.epic || [];
      const steam = stock.steam || [];

      const backupText =
`=== GENERATOR STOCK BACKUP ===

--- ROBLOX (${roblox.length}) ---
${roblox.length ? roblox.join("\n") : "No accounts"}

--- EPIC GAMES (${epic.length}) ---
${epic.length ? epic.join("\n") : "No accounts"}

--- STEAM (${steam.length}) ---
${steam.length ? steam.join("\n") : "No accounts"}

=== END OF BACKUP ===`;

      const filePath = "./stock-backup.txt";
      fs.writeFileSync(filePath, backupText);

      const file = new AttachmentBuilder(filePath);

      const embed = new EmbedBuilder()
        .setColor(purple)
        .setTitle("📦 Stock Backup Generated")
        .setDescription("Your stock backup file is ready for download.")
        .addFields(
          { name: "Roblox", value: `${roblox.length}`, inline: true },
          { name: "Epic Games", value: `${epic.length}`, inline: true },
          { name: "Steam", value: `${steam.length}`, inline: true },
          { name: "Total Accounts", value: `${roblox.length + epic.length + steam.length}` }
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        files: [file]
      });

      const logChannel = interaction.client.channels.cache.get(logChannelId);
      if (logChannel) {
        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(purple)
              .setTitle("📁 Stock Backup Created")
              .setDescription(`Backup created by: **${interaction.user.tag}**`)
              .setTimestamp()
          ]
        }).catch(() => {});
      }

      fs.unlinkSync(filePath);

    } catch (err) {
      console.error("❌ ERROR IN /backupstock:", err);

      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🚨 Critical Error")
        .setDescription("Something went wrong while creating the backup.")
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
      } else {
        interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      }
    }
  },
};
