const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");

// Validar HEX (#RRGGBB o #RGB)
const isValidHexColor = hex => /^#([A-F0-9]{6}|[A-F0-9]{3})$/i.test(hex);

// Validar URL de imagen
const isValidImageUrl = url =>
  /^https?:\/\/.*\.(png|jpe?g|gif|webp)$/i.test(url);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Send a custom message or embed as the Codura bot.")
    .addStringOption(option =>
      option
        .setName("type")
        .setDescription("Type of message to send.")
        .setRequired(true)
        .addChoices(
          { name: "Normal", value: "normal" },
          { name: "Embed", value: "embed" }
        )
    )
    .addStringOption(option =>
      option.setName("message").setDescription("Message content.")
    )
    .addStringOption(option =>
      option.setName("title").setDescription("Embed or message title.")
    )
    .addStringOption(option =>
      option
        .setName("mention")
        .setDescription("Mention a user or role (e.g., @User @Role).")
    )
    .addStringOption(option =>
      option.setName("image_url").setDescription("URL of an image to include.")
    )
    .addAttachmentOption(option =>
      option
        .setName("image_attachment")
        .setDescription("Attach an image directly.")
    )
    .addStringOption(option =>
      option
        .setName("color")
        .setDescription("Embed color (HEX format, e.g., #00bfff).")
    )
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel to send the message.")
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    const allowedRole = "1440108012176933116"; // SOLO ESTE ROL

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      if (!member.roles.cache.has(allowedRole)) {
        return interaction.reply({
          content: "⛔ Only **Codura Admin** can use this command.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const type = interaction.options.getString("type");
      const message = interaction.options.getString("message")?.trim() || "";
      const title = interaction.options.getString("title")?.trim() || null;
      const mention = interaction.options.getString("mention") || null;
      const imageUrl = interaction.options.getString("image_url") || null;
      const imageAttachment = interaction.options.getAttachment("image_attachment");
      const inputColor = interaction.options.getString("color");
      const channel =
        interaction.options.getChannel("channel") || interaction.channel;

      // Validar color
      let color = "#00bfff";
      if (inputColor) {
        if (!isValidHexColor(inputColor)) {
          return interaction.reply({
            content: "❌ Invalid HEX color format.",
            flags: MessageFlags.Ephemeral,
          });
        }
        color = inputColor;
      }

      // Validar URL imagen
      if (imageUrl && !isValidImageUrl(imageUrl)) {
        return interaction.reply({
          content: "❌ The provided image URL is invalid.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // Validar attachment
      if (
        imageAttachment &&
        !imageAttachment.contentType?.startsWith("image/")
      ) {
        return interaction.reply({
          content: "❌ The attached file is not a valid image.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // 📌 EMBED
      if (type === "embed") {
        const embed = new EmbedBuilder().setColor(color);

        if (title) embed.setTitle(title);
        if (message) embed.setDescription(message);
        if (imageAttachment) embed.setImage(imageAttachment.url);
        else if (imageUrl) embed.setImage(imageUrl);

        await channel.send({
          content: mention || null,
          embeds: [embed],
        });
      } else {
        // 📌 MENSAJE NORMAL
        const parts = [];

        if (mention) parts.push(mention);
        if (title) parts.push(`**${title}**`);
        if (message) parts.push(message);

        const content = parts.join("\n") || "(empty message)";
        const files = [];

        if (imageAttachment) files.push(imageAttachment);
        else if (imageUrl) files.push(imageUrl);

        await channel.send({ content, files });
      }

      await interaction.reply({
        content: "✅ Message sent successfully.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("ERROR IN /say:", error);

      if (!interaction.replied) {
        interaction.reply({
          content: "❌ An unexpected error occurred.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
