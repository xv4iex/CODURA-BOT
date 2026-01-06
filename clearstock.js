const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clearstock")
    .setDescription("⚠️ Clear ALL stock from all services."),
  
  async execute(interaction) {
    const requiredRole = "1440108012176933116"; // Staff
    const logChannelId = "1440118861083971736";
    const orange = 0xFFA500;

    try {
      // ROLE CHECK
      if (!interaction.member.roles.cache.has(requiredRole)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("⛔ Permission Denied")
              .setDescription("You do not have permission to use this command.")
          ],
          flags: 64 // ephemeral
        });
      }

      await interaction.deferReply({ flags: 64 });

      const stock = interaction.client.serviceStock;

      if (!stock) {
        throw new Error("Stock object not initialized");
      }

      // Guardamos valores antes de limpiar
      const beforeRoblox = stock.roblox?.length || 0;
      const beforeEpic = stock.epic?.length || 0;
      const beforeSteam = stock.steam?.length || 0;
      const beforeTotal = beforeRoblox + beforeEpic + beforeSteam;

      // Limpiar stock
      stock.roblox = [];
      stock.epic = [];
      stock.steam = [];

      // Embed para el staff
      const embed = new EmbedBuilder()
        .setColor(orange)
        .setTitle("🗑️ Stock Cleared")
        .setDescription("All stock from all services has been successfully cleared.")
        .addFields(
          { name: "Roblox Removed", value: `${beforeRoblox}`, inline: true },
          { name: "Epic Games Removed", value: `${beforeEpic}`, inline: true },
          { name: "Steam Removed", value: `${beforeSteam}`, inline: true },
          { name: "Total Removed", value: `**${beforeTotal} Accounts**` }
        )
        .setFooter({ text: `Cleared by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // LOGS
      const logChannel = interaction.client.channels.cache.get(logChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(orange)
          .setTitle("🧹 Stock Wiped")
          .setDescription(`Staff **${interaction.user.tag}** cleared the ENTIRE stock.`)
          .addFields(
            { name: "Roblox Deleted", value: `${beforeRoblox}`, inline: true },
            { name: "Epic Games Deleted", value: `${beforeEpic}`, inline: true },
            { name: "Steam Deleted", value: `${beforeSteam}`, inline: true },
            { name: "Total Deleted", value: `${beforeTotal}`, inline: true }
          )
          .setTimestamp();

        logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }

    } catch (err) {
      console.error("❌ ERROR in /clearstock:", err);

      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🚨 Critical Error")
        .setDescription("Something went wrong while clearing the stock.")
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
      } else {
        interaction.reply({ embeds: [errorEmbed], flags: 64 }).catch(() => {});
      }
    }
  }
};
