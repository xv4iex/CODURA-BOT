const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "stock",
  description: "View the stock for all services.",
  usage: "!stock",

  async execute(client, message) {
    const PURPLE = "#8A2BE2";
    const LOG_CHANNEL_ID = "1440118861083971736";

    try {
      // Evitar uso en DM
      if (!message.guild) {
        return message.channel.send("❌ This command cannot be used in DMs.");
      }

      // Asegurar que el stock exista
      if (!client.serviceStock) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PURPLE)
              .setTitle("❌ Stock not initialized")
              .setDescription("No stock data found. Add stock first using `!add`.")
          ]
        });
      }

      const stock = client.serviceStock;

      // Obtener cantidades
      const robloxCount = stock.roblox?.length || 0;
      const epicCount = stock.epic?.length || 0;
      const steamCount = stock.steam?.length || 0;

      const total = robloxCount + epicCount + steamCount;

      // Embed principal
      const embed = new EmbedBuilder()
        .setColor(PURPLE)
        .setTitle("📦 Generator Stock")
        .setDescription("Stock actual disponible para todos los servicios.")
        .addFields(
          { name: "Roblox", value: `**${robloxCount}**`, inline: true },
          { name: "Epic Games", value: `**${epicCount}**`, inline: true },
          { name: "Steam", value: `**${steamCount}**`, inline: true },
          { name: "Total Stock", value: `**${total}** cuentas` }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      // ====== LOGS ======
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);

      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(PURPLE)
          .setTitle("📊 Stock Requested")
          .setDescription(`El usuario **${message.author.tag}** consultó el stock.`)
          .addFields(
            { name: "Roblox", value: `${robloxCount}`, inline: true },
            { name: "Epic Games", value: `${epicCount}`, inline: true },
            { name: "Steam", value: `${steamCount}`, inline: true },
            { name: "Total", value: `${total}`, inline: true }
          )
          .setTimestamp();

        logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }

    } catch (err) {
      console.error("❌ ERROR IN !stock:", err);

      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🚨 Critical Error")
        .setDescription("An unexpected error occurred while checking the stock.")
        .setTimestamp();

      try {
        await message.reply({ embeds: [errorEmbed] });
      } catch {}
    }
  }
};
