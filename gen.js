// commands/slash/gen.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gen")
    .setDescription("Generate an account from the selected service.")
    .addStringOption((option) =>
      option
        .setName("service")
        .setDescription("Choose the service you want to generate.")
        .setRequired(true)
        .addChoices(
          { name: "Roblox", value: "roblox" },
          { name: "Epic Games", value: "epic" },
          { name: "Steam", value: "steam" }
        )
    ),

  async execute(interaction) {
    const PURPLE = "#8A2BE2";
    const LOG_CHANNEL_ID = "1440118861083971736";
    const ALLOWED_CHANNEL = "1439841289934995537";
    const PREMIUM_ROLE = "1440177138731843646";

    try {
      // -------- CHECK: Guild only --------
      if (!interaction.guild) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PURPLE)
              .setTitle("📵 Command Disabled in DMs")
              .setDescription("This command can only be used **inside the server**.")
          ],
          ephemeral: true
        });
      }

      // -------- CHECK: Allowed channel --------
      if (interaction.channel.id !== ALLOWED_CHANNEL) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PURPLE)
              .setTitle("📛 Wrong Channel")
              .setDescription(`Use this command **only in** <#${ALLOWED_CHANNEL}>.`)
          ],
          ephemeral: true
        });
      }

      const service = interaction.options.getString("service");

      // -------- CHECK: Stock exists --------
      const stock = interaction.client.serviceStock?.[service];

      if (!stock || stock.length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("❌ Out of Stock")
              .setDescription(`There are **no accounts** available for **${service.toUpperCase()}**.`)
          ],
          ephemeral: true
        });
      }

      // -------- COOLDOWN SYSTEM --------
      if (!interaction.client.genCooldown) interaction.client.genCooldown = new Map();

      const cooldown = interaction.client.genCooldown;
      const key = `${interaction.user.id}_${service}`;

      const now = Date.now();
      const isPremium = interaction.member.roles.cache.has(PREMIUM_ROLE);

      // Premium: 15 min — Free: 60 min
      const cdTime = isPremium ? 15 * 60 * 1000 : 60 * 60 * 1000;

      if (cooldown.has(key)) {
        const expires = cooldown.get(key);
        if (now < expires) {
          const remaining = expires - now;
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(PURPLE)
                .setTitle("⏳ Cooldown Active")
                .setDescription(
                  `You must wait **${mins}m ${secs}s** before generating another **${service}** account.`
                )
            ],
            ephemeral: true
          });
        }
      }

      cooldown.set(key, now + cdTime);

      // -------- TAKE ACCOUNT --------
      const account = stock.shift();

      // -------- SEND DM --------
      const dmEmbed = new EmbedBuilder()
        .setColor(PURPLE)
        .setTitle(`🎁 Your ${service.toUpperCase()} Account`)
        .addFields({
          name: "🔑 Credentials",
          value: `\`\`\`${account}\`\`\``
        })
        .setFooter({ text: "Thanks for using the generator!" })
        .setTimestamp();

      let dmSent = true;
      try {
        await interaction.user.send({ embeds: [dmEmbed] });
      } catch {
        dmSent = false;
      }

      // -------- PUBLIC REPLY --------
      const publicEmbed = new EmbedBuilder()
        .setColor(PURPLE)
        .setTitle("✅ Account Generated")
        .setDescription(
          dmSent
            ? "Your account has been **sent to your DMs**. Check your inbox!"
            : "❌ I couldn't DM you. Please enable **DMs from server members**."
        )
        .setTimestamp();

      await interaction.reply({ embeds: [publicEmbed] });

      // -------- LOGS --------
      const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(PURPLE)
          .setTitle("📤 Account Generated")
          .addFields(
            { name: "Service", value: service.toUpperCase(), inline: true },
            { name: "User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: "DM Sent", value: dmSent ? "✔️ Yes" : "❌ No", inline: true },
            { name: "Remaining Stock", value: `${stock.length}`, inline: true },
            { name: "Account Delivered", value: `\`\`\`${account}\`\`\`` }
          )
          .setTimestamp();

        logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    } catch (error) {
      console.error("❌ ERROR IN /gen:", error);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle("🚨 Internal Error")
            .setDescription("Something unexpected happened. Please try again later.")
        ],
        ephemeral: true
      });
    }
  },
};
