const { EmbedBuilder } = require("discord.js");

const STAFF_ROLE = "1440108012176933116";
const LOG_CHANNEL_ID = "1440118861083971736";

const VALID_SERVICES = ["roblox", "epic", "steam"];

module.exports = {
  name: "add",
  description: "Add stock to a service.",
  usage: "!add <service> <email:pass> <email:pass> ...",

  async execute(client, message, args) {
    try {
      if (!message.guild) {
        return message.channel.send("❌ This command cannot be used in DMs.");
      }

      if (!message.member.roles.cache.has(STAFF_ROLE)) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#8A2BE2")
              .setTitle("⛔ Permisos insuficientes")
              .setDescription("No tienes permiso para usar este comando.")
          ]
        });
      }

      // Crear almacenamiento global si no existe
      if (!client.serviceStock) {
        client.serviceStock = {
          roblox: [],
          epic: [],
          steam: []
        };
      }

      // Servicio seleccionado
      const service = args.shift()?.toLowerCase();

      if (!VALID_SERVICES.includes(service)) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#8A2BE2")
              .setTitle("❌ Servicio inválido")
              .setDescription("Servicios válidos:\n```\nroblox\nepic\nsteam\n```")
          ]
        });
      }

      if (args.length === 0) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#8A2BE2")
              .setTitle("❌ No se proporcionaron cuentas")
              .setDescription("Debes incluir al menos **una** cuenta.")
          ]
        });
      }

      const stock = client.serviceStock[service];

      // Filtrar formato correcto email:pass
      const validAccounts = args.filter(acc => acc.includes(":"));

      if (validAccounts.length === 0) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#8A2BE2")
              .setTitle("❌ Formato incorrecto")
              .setDescription("Todas las cuentas deben tener el formato **email:pass**.")
          ]
        });
      }

      // Evitar duplicados
      const before = stock.length;

      const addedAccounts = validAccounts.filter(acc => !stock.includes(acc));
      const duplicates = validAccounts.length - addedAccounts.length;

      stock.push(...addedAccounts);

      const after = stock.length;
      const added = after - before;

      // ===== RESPUESTA AL STAFF =====
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#8A2BE2")
            .setTitle("✨ Stock actualizado")
            .setDescription(`Stock agregado para **${service}**.`)
            .addFields(
              { name: "Agregados", value: `${added}`, inline: true },
              { name: "Duplicados ignorados", value: `${duplicates}`, inline: true },
              { name: "Total actual", value: `${after}`, inline: true }
            )
            .setTimestamp()
        ]
      });

      // ===== REGISTRO EN LOGS =====
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);

      if (logChannel) {
        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#8A2BE2")
              .setTitle("📥 Stock añadido")
              .setDescription("Se han añadido cuentas al stock.")
              .addFields(
                { name: "Servicio", value: service, inline: true },
                { name: "Agregados", value: `${added}`, inline: true },
                { name: "Duplicados", value: `${duplicates}`, inline: true },
                { name: "Staff", value: message.author.tag, inline: true }
              )
              .addFields([
                {
                  name: "Cuentas añadidas",
                  value: added > 0
                    ? `\`\`\`\n${addedAccounts.join("\n")}\n\`\`\``
                    : "Ninguna"
                }
              ])
              .setTimestamp()
          ]
        });
      }

    } catch (error) {
      console.error("❌ Error in !add command:", error);
      message.reply("❌ Hubo un error al agregar stock.");
    }
  }
};
