// commands/slash/shop.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("View all available service categories and prices.")
    .addStringOption((option) =>
      option
        .setName("service")
        .setDescription("Select the service category you want to view.")
        .setRequired(true)
        .addChoices(
          { name: "TikTok", value: "tiktok" },
          { name: "YouTube", value: "youtube" },
          { name: "Discord", value: "discord" },
          { name: "SABshop", value: "sabshop" }
        )
    ),

  async execute(interaction) {
    try {
      const service = interaction.options.getString("service");
      const mainColor = 0x8a2be2;
      const footerText = "Orders may take 0–72 hours to be completed. • Support available via tickets";

      const embeds = {
        tiktok: new EmbedBuilder()
          .setTitle("📱 TikTok Growth Services")
          .setColor(mainColor)
          .setDescription(
            "Boost your TikTok presence with fast, safe, and high-quality engagement services.\n\n" +
              "**Perfect for creators, influencers, agencies, and brands** looking to strengthen their visibility and influence.\n\n" +
              "Our TikTok packages offer stable delivery, affordable pricing, and reliable support."
          )
          .addFields(
            { name: "👥 Followers", value: "$1 per 1,000", inline: true },
            { name: "👀 Views", value: "$1 per 100,000", inline: true },
            { name: "❤️ Likes", value: "$1 per 5,000", inline: true }
          )
          .addFields({
            name: "📌 Notes",
            value:
              "Deliveries are staggered to look organic. We never ask for passwords.",
          })
          .setFooter({ text: footerText })
          .setTimestamp(),

        youtube: new EmbedBuilder()
          .setTitle("▶️ YouTube Promotion Services")
          .setColor(mainColor)
          .setDescription(
            "Enhance your YouTube channel’s visibility, authority, and engagement.\n\n" +
              "Ideal for creators who want to improve reach, recommendation chances, and channel credibility.\n\n" +
              "All deliveries are performed smoothly with quality controls."
          )
          .addFields(
            { name: "📌 Subscribers", value: "$1 per 1,000", inline: true },
            { name: "👀 Views", value: "$1 per 2,000", inline: true },
            { name: "👍 Likes", value: "$1 per 3,000", inline: true }
          )
          .addFields({
            name: "📌 Ideal For",
            value:
              "New channels, monetization push, collaboration campaigns, and algorithm boosts.",
          })
          .setFooter({ text: footerText })
          .setTimestamp(),

        discord: new EmbedBuilder()
          .setTitle("💠 Discord Member Services")
          .setColor(mainColor)
          .setDescription(
            "Strengthen your community with high-quality Discord member additions.\n\n" +
              "Suitable for new servers, public communities, and creators who want to increase perceived activity and reach."
          )
          .addFields({ name: "👥 Members", value: "$5 per 1,000", inline: true })
          .addFields({
            name: "📌 Safety",
            value:
              "We use safe delivery methods aimed at avoiding spam or server penalties. Retention options available upon request.",
          })
          .setFooter({ text: footerText })
          .setTimestamp(),

        sabshop: new EmbedBuilder()
          .setTitle("🎁 SABshop — Random Secret Reward Packs")
          .setColor(mainColor)
          .setDescription(
            "Exclusive mystery packs containing fully random rewards within each selected range.\n\n" +
              "Designed for users who enjoy surprise rewards and the chance for very high payouts.\n\n" +
              "Each purchase guarantees a reward inside the selected range — some packs may yield higher-than-expected value."
          )
          .addFields(
            { name: "1m – 9m", value: "$3", inline: true },
            { name: "10m – 20m", value: "$5", inline: true },
            { name: "21m – 50m", value: "$8", inline: true },
            { name: "51m – 150m", value: "$12", inline: true },
            { name: "151m – 500m", value: "$20", inline: true },
            { name: "500m+ (Ultra Rare)", value: "$30", inline: true }
          )
          .addFields({
            name: "📌 Important",
            value:
              "Pack rewards are random. No refunds for RNG-based results unless a delivery failure occurs.",
          })
          .setFooter({ text: footerText })
          .setTimestamp(),
      };

      const chosen = embeds[service];
      if (!chosen) {
        return interaction.reply({
          content: "❌ Invalid service option. Please select a valid category.",
          ephemeral: true,
        });
      }

      await interaction.reply({ embeds: [chosen] });
    } catch (err) {
      console.error("[ERROR] /shop command failed:", err);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: "❌ An unexpected error occurred. Please try again later.",
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: "❌ An unexpected error occurred. Please try again later.",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  },
};
