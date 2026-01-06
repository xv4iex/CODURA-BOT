

// index.js — Versión mejorada, estable y anti-crash (Discord.js v15, CommonJS)
// Reemplaza tu index.js por este archivo.

// Cargar variables de entorno
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

// Constante para respuestas privadas (ephemeral)
const EPHEMERAL = 64;

// ----------------------------
// Logger mínimo (puedes reemplazar por winston/pino)
// ----------------------------
function log(level, ...args) {
  const time = new Date().toISOString();
  console[level](`[${time}]`, ...args);
}

// ----------------------------
// Cliente
// ----------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
  allowedMentions: { parse: ["users", "roles"], repliedUser: false },
});

// Colecciones
client.slashCommands = new Collection();
client.prefixCommands = new Collection();
client.serviceStock = {
  roblox: [],
  epic: [],
  steam: []
};

// Ajustes
client.responderActivado = false;
const prefix = process.env.PREFIX || "!";

// ----------------------------
// Util: recorrer carpetas recursivamente y cargar .js
// ----------------------------
function requireFresh(filePath) {
  delete require.cache[require.resolve(filePath)];
  return require(filePath);
}

function readJSFilesRecursive(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...readJSFilesRecursive(resolved));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(resolved);
  }
  return files;
}

// ----------------------------
// Cargar comandos slash
// ----------------------------
function loadSlashCommands() {
  const dir = path.join(__dirname, "commands", "slash");
  if (!fs.existsSync(dir)) {
    log("warn", "⚠️ No existe la carpeta /commands/slash");
    return;
  }

  const files = readJSFilesRecursive(dir);
  for (const filePath of files) {
    try {
      const command = requireFresh(filePath);

      if (!command?.data?.name || typeof command.execute !== "function") {
        log("warn", `⚠️ Comando slash inválido o mal formado: ${filePath}`);
        continue;
      }

      // Opcional: metadata como defer por defecto
      client.slashCommands.set(command.data.name, command);
      log("info", `✅ Cargado slash: ${command.data.name}`);
    } catch (err) {
      log("error", `❌ Error cargando slash ${filePath}:`, err.stack || err);
    }
  }
}

// ----------------------------
// Cargar comandos con prefijo
// ----------------------------
function loadPrefixCommands() {
  const dir = path.join(__dirname, "commands", "prefix");
  if (!fs.existsSync(dir)) {
    log("warn", "⚠️ No existe la carpeta /commands/prefix");
    return;
  }

  const files = readJSFilesRecursive(dir);
  for (const filePath of files) {
    try {
      const command = requireFresh(filePath);

      if (!command?.name || typeof command.execute !== "function") {
        log("warn", `⚠️ Prefijo inválido o mal formado: ${filePath}`);
        continue;
      }

      client.prefixCommands.set(command.name.toLowerCase(), command);
      log("info", `✅ Cargado prefix: ${command.name}`);
    } catch (err) {
      log("error", `❌ Error cargando prefix ${filePath}:`, err.stack || err);
    }
  }
}

// ----------------------------
// Manejador global de interacciones (slash)
// - Soporta comandos que exporten "defer: true"
// - Validaciones para evitar null derefs
// ----------------------------
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const cmd = client.slashCommands.get(interaction.commandName);
    if (!cmd) {
      // No hay comando registrado; responder de forma segura (silenciosa)
      log("warn", `Comando no encontrado: ${interaction.commandName}`);
      return interaction.reply?.({
        content: "❌ Comando no disponible.",
        flags: EPHEMERAL,
      }).catch(() => {});
    }

    // Seguridad: validar guild si el comando requiere guildOnly
    if (cmd.guildOnly && !interaction.guild) {
      return interaction.reply({
        content: "❌ Este comando solo puede usarse en servidores (guilds).",
        flags: EPHEMERAL,
      }).catch(() => {});
    }

    // Si el comando solicita defer explícitamente (o define cmd.defer === true), deferimos
    const shouldDefer = !!cmd.defer;
    if (shouldDefer) {
      try {
        await interaction.deferReply({ flags: EPHEMERAL });
      } catch (e) {
        // Si defer falla, continuar intentando ejecutar el comando (pero evitar crash)
        log("warn", "No se pudo deferReply para", interaction.commandName, e?.message ?? e);
      }
    }

    // Ejecutar el comando con tiempo limitado (opcional: implementar timeout)
    await cmd.execute(interaction);
  } catch (err) {
    // Manejo robusto de errores por comando: informar al usuario sin romper el bot
    log("error", `❌ Error ejecutando slash "${interaction.commandName}":`, err.stack ?? String(err));

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Error")
      .setDescription("Ocurrió un error al ejecutar este comando. El equipo ya fue notificado.")
      .setTimestamp();

    // Intentar informar al usuario respetando el estado de la interacción
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], flags: EPHEMERAL }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [embed], flags: EPHEMERAL }).catch(() => {});
      }
    } catch (replyErr) {
      // No podemos hacer más si Discord no acepta respuestas en este momento
      log("error", "No se pudo notificar al usuario sobre el error:", replyErr?.message ?? replyErr);
    }
  }
});

// ----------------------------
// Manejador unificado de mensajes (prefijo, responder, mention)
// Un solo listener para evitar duplicidad
// ----------------------------
client.on("messageCreate", async (message) => {
  try {
    // Ignorar bots y mensajes sin contenido
    if (!message || message.author?.bot) return;

    // ----------------------------
    // 1) Sistema responder (embed automático)
    // ----------------------------
    // Ejecutar alto nivel: solo si responder activado y autor es el autorizado
    if (
      client.responderActivado &&
      message.author.id === "1054794163993985118" &&
      message.content?.toLowerCase() !== `${prefix}responder`
    ) {
      try {
        const embed = new EmbedBuilder()
          .setColor(0x000000)
          .setAuthor({ name: "Codura", iconURL: client.user?.displayAvatarURL?.() ?? null })
          .setThumbnail(client.user?.displayAvatarURL?.() ?? null)
          .setDescription(message.content || "[No content]");

        // Buscar imagen por contentType o por nombre
        const attachments = Array.from(message.attachments.values());
        const image = attachments.find((att) =>
          (att.contentType && att.contentType.startsWith("image")) ||
          (att.name && /\.(png|jpe?g|gif|webp)$/i.test(att.name))
        );

        if (image) embed.setImage(image.url);

        const otherFiles = attachments.filter((att) => !((att.contentType && att.contentType.startsWith("image")) || (att.name && /\.(png|jpe?g|gif|webp)$/i.test(att.name))));
        if (otherFiles.length) {
          embed.addFields({
            name: "Attachments",
            value: otherFiles.map((att) => `[${att.name ?? "file"}](${att.url})`).join("\n").slice(0, 1024),
          });
        }

        // Intentar borrar el mensaje original (si permisos) y enviar embed
        await message.delete().catch(() => {});
        await message.channel.send({ embeds: [embed] }).catch(() => {});
      } catch (err) {
        log("error", "❌ Error en responder embed:", err.stack ?? err);
      }
      // Si ya se procesó como "responder", no continuar con prefijo / mention
      return;
    }

// ----------------------------
// 2) Menciones al bot (mention handler)
// ----------------------------
const botId = client.user?.id;
if (botId) {
  const mention1 = `<@${botId}>`;
  const mention2 = `<@!${botId}>`;

  if (
    message.content === mention1 ||
    message.content === mention2 ||
    message.content.startsWith(mention1) ||
    message.content.startsWith(mention2)
  ) {
    try {
      const clean = message.content.replace(new RegExp(`<@!?${botId}>`, "g"), "").trim();

      // Respuestas cuando mencionan al bot
      const replies = [
        "👋 Hey! I'm Codura — the server’s official bot.",
        "⚙️ Codura here. I handle tools, generators, and all main services.",
        "🚀 Need resources? I provide fast and secure access to everything.",
        "📌 Mention me anytime to view utilities, tools, and server services.",
        "🤖 Codura at your service — optimized, reliable, and ready to assist.",
      ];

      // Tips adicionales
      const tips = [
        "💡 Tip: Use `/help` to explore all available tools and services.",
        "⚙️ Want access to generators or resources? Check `/help`.",
        "🛠️ Discover everything Codura can do using `/help`.",
      ];

      const finalMsg =
        replies[Math.floor(Math.random() * replies.length)] +
        (clean ? `\n\n💬 You also said: "${clean}"` : "") +
        `\n\n${tips[Math.floor(Math.random() * tips.length)]}`;

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("📢 You mentioned Codura")
        .setDescription(finalMsg)
        .setFooter({
          text: `Mentioned by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      // Si no quieres botones, dejamos esto vacío:
      await message.reply({ embeds: [embed] }).catch(() => {});

    } catch (err) {
      log("error", "❌ Error en mention handler:", err.stack ?? err);
    }
    return;
  }
}

// ----------------------------
// 3) Prefijo (comandos tradicionales)
// ----------------------------
if (!message.content.startsWith(prefix)) return;

const [rawName, ...rawArgs] = message.content.slice(prefix.length).trim().split(/ +/);
const cmdName = rawName?.toLowerCase();
if (!cmdName) return;

const cmd = client.prefixCommands.get(cmdName);
if (!cmd) return;

try {
  // Validaciones de permisos del bot/usuario si el comando define expects
  if (cmd.guildOnly && !message.guild) {
    return message.reply({ content: "❌ Este comando solo funciona en servidores.", flags: EPHEMERAL }).catch(() => {});
  }

  // ❗️ AQUÍ ESTABA EL ERROR
  await cmd.execute(client, message, rawArgs);

} catch (err) {
  log("error", `❌ Error ejecutando prefix "${cmdName}":`, err.stack ?? String(err));

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("❌ Error")
    .setDescription("Ocurrió un error al ejecutar este comando.")
    .setTimestamp();

  try {
    await message.reply({ embeds: [embed] }).catch(() => {});
  } catch (replyErr) {
    log("error", "No se pudo notificar en ejecucion de prefijo:", replyErr?.message ?? replyErr);
  }
}
  } catch (err) {
    // Cualquier error imprevisto en el listener no rompe el bot
    log("error", "❌ Error inesperado en messageCreate:", err.stack ?? err);
  }
});

// ----------------------------
// Ready
// ----------------------------
client.once("ready", () => {
  log("info", `✅ Bot listo como ${client.user?.tag}`);
  // Opcional: set presence
  try {
    client.user.setPresence?.({ activities: [{ name: `Codura On Top` }], status: "online" }).catch(() => {});
  } catch {}
});

// ----------------------------
// Inicialización segura
// ----------------------------
(async function init() {
  try {
    // Cargar comandos
    loadSlashCommands();
    loadPrefixCommands();

    // Registro condicional de sistemas externos (verification)
    try {
      const verificationPath = path.join(__dirname, "commands", "slash", "verification.js");
      if (fs.existsSync(verificationPath)) {
        const verification = requireFresh(verificationPath);
        if (verification?.register) {
          await verification.register(client);
          log("info", "✅ Verification system registered.");
        }
      }
    } catch (e) {
      log("warn", "No se pudo registrar verification:", e?.message ?? e);
    }

    // Login
    const token = process.env.TOKEN;
    if (!token) throw new Error("TOKEN de Discord no encontrado en .env");
    await client.login(token);
  } catch (err) {
    log("error", "❌ Error crítico iniciando el bot:", err.stack ?? err);
    // No re-throw: queremos evitar crash completo en entornos donde se monitoriza el proceso
  }
})();

// ----------------------------
// Graceful shutdown & manejo global de errores
// ----------------------------
process.on("unhandledRejection", (reason, p) => {
  log("error", "❌ unhandledRejection:", reason, p);
  // Opcional: reportar a Sentry
});

process.on("uncaughtException", (err) => {
  log("error", "❌ uncaughtException:", err.stack ?? err);
  // Intentar cierre ordenado
  try {
    client.destroy();
  } catch {}
  // En ambientes con PM2/forever/systemd, el proceso puede reiniciarse. No forzamos exit aquí para permitir análisis.
});

["SIGINT", "SIGTERM", "SIGQUIT"].forEach((sig) => {
  process.on(sig, async () => {
    log("info", `Recibida señal ${sig}, cerrando bot...`);
    try {
      await client.destroy();
      log("info", "Cliente destruido correctamente.");
    } catch (e) {
      log("warn", "Error al destruir cliente:", e?.message ?? e);
    }
    process.exit(0);
  });
});
