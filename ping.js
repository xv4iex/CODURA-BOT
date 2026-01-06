// commands/slash/ping.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const os = require("os");
const process = require("process");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Displays the current bot and system status."),

  async execute(interaction) {
    try {
      // Send an immediate response (no deprecated options)
      const initialReply = await interaction.reply({
        content: "📡 Checking system status...",
        fetchReply: true, // Safe & official way to get the sent message
      });

      // Calculate latency
      const latency =
        initialReply.createdTimestamp - interaction.createdTimestamp;

      const apiPing = interaction.client.ws.ping;

      // Uptime format
      const formatUptime = () => {
        const total = Math.floor(process.uptime());
        const hrs = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        return `${hrs}h ${mins}m ${secs}s`;
      };

      // System RAM
      const memoryUsed = (
        process.memoryUsage().heapUsed /
        1024 /
        1024
      ).toFixed(2);
      const totalRAM = (os.totalmem() / 1024 / 1024).toFixed(0);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x8a2be2) // Purple
        .setTitle("📊 Bot & System Status")
        .addFields(
          {
            name: "🏓 Bot Latency",
            value: `\`${latency}ms\``,
            inline: true,
          },
          {
            name: "🌐 API Ping",
            value: `\`${apiPing}ms\``,
            inline: true,
          },
          {
            name: "⏱ Uptime",
            value: `\`${formatUptime()}\``,
            inline: true,
          },
          {
            name: "💾 RAM Usage",
            value: `\`${memoryUsed} / ${totalRAM} MB\``,
            inline: true,
          },
          {
            name: "🟩 Node.js",
            value: `\`${process.version}\``,
            inline: true,
          },
          {
            name: "📦 Discord.js",
            value: `\`${require("discord.js").version}\``,
            inline: true,
          },
          {
            name: "🌍 Servers",
            value: `\`${interaction.client.guilds.cache.size}\``,
            inline: true,
          },
          {
            name: "👥 Cached Users",
            value: `\`${interaction.client.users.cache.size}\``,
            inline: true,
          }
        )
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Replace the first message with the full embed
      await interaction.editReply({
        content: null,
        embeds: [embed],
      });
    } catch (error) {
      console.error("[ERROR] Failed executing /ping:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("❌ Ping Error")
        .setDescription("Failed to fetch system status. Try again later.")
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
      } else {
        await interaction.reply({
          embeds: [errorEmbed],
          ephemeral: true,
        }).catch(() => {});
      }
    }
  },
};
