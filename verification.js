/**
 * verification.fused.js — Final Super-Enhanced (everything added, nothing removed)
 * - Discord.js v14 / Node.js v22
 * - All responses in EMBEDS (utility emojis only: ⚠️ ❌ ✅ ℹ️)
 * - Ephemeral responses (flags: 64)
 *
 * Notes:
 * - I DID NOT DELETE any original logic. I only ADDED and ENRICHED content.
 * - The captcha challenge embed now contains the exact friendly/helpful text you requested,
 *   plus Session Details (time left, attempts remaining).
 * - Panel embed is strictly onboarding/publish info (no captcha instructions).
 * - DM embeds, logs, footers, timestamps, thumbnails, and richer fields added.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  PermissionFlagsBits
} = require("discord.js");

/* ---------------------------
   Configuration (IDs & settings)
   --------------------------- */

const DEV_ROLE = "1439835074001506408"; // Developer (can publish the panel)
const MEMBER_ROLE = "1439834985803681896"; // Member role to assign
const LOG_CHANNEL = "1440914331079282748"; // Channel to send logs

// Timers & limits
const VERIFICATION_PERIOD_MS = 2 * 60 * 1000; // 2 minutes
const MAX_ATTEMPTS = 5;

// Footer label
const FOOTER_LABEL = "Verification System | Powered by YourBot";

// Themes (kept both sets as requested)
const THEMES = {
  primaryA: {
    THEME_COLOR: "#9b5cff",   // morado principal
    WARN_COLOR: "#c77dff",    // morado claro
    ERROR_COLOR: "#a200ff",   // morado fuerte
    SUCCESS_COLOR: "#b088f9", // morado pastel
    INFO_COLOR: "#6a4ca3"     // morado oscuro
  },
  primaryB: {
    THEME_COLOR: "#b57bff",   // morado suave
    WARN_COLOR: "#d9a7ff",    // morado claro pastel
    ERROR_COLOR: "#8c00ff",   // morado intenso
    SUCCESS_COLOR: "#caa2ff", // morado claro
    INFO_COLOR: "#7c51c4"     // morado oscuro vibrante
  }
};

const ACTIVE_THEME = THEMES.primaryB;

/* ---------------------------
   Captcha dataset (unchanged)
   --------------------------- */

const CAPTCHA_SET = [
  { code: "kymedp", url: "https://cdn.discordapp.com/attachments/1320835661804343348/1411711865649889371/wickCaptcha.png" },
  { code: "blsryt", url: "https://cdn.discordapp.com/attachments/1320835661804343348/1411711869533683833/wickCaptcha-1.png" },
  { code: "sldwhm", url: "https://cdn.discordapp.com/attachments/1320835661804343348/1411712924925558894/wickCaptcha-2.png" },
  { code: "vcptei", url: "https://cdn.discordapp.com/attachments/1320835661804343348/1411713600808161452/wickCaptcha-3.png" },
  { code: "qvqfgk", url: "https://cdn.discordapp.com/attachments/1320835661804343348/1411714274551922848/wickCaptcha-4.png" },
  { code: "pqkvdm", url: "https://cdn.discordapp.com/attachments/1320835661804343348/1411714906671153213/wickCaptcha-5.png" },
  { code: "gihmsn", url: "https://cdn.discordapp.com/attachments/1320835661804343348/1411715712287899729/wickCaptcha-6.png" },
];

/* ---------------------------
   Active sessions
   Map<userId, { code, url, createdAt, attempts, timeout }>
   --------------------------- */

const activeCaptchas = new Map();

/* ---------------------------
   Helpers
   --------------------------- */

const pickCaptchaRandom = () => {
  if (CAPTCHA_SET.length === 0) return null;
  return CAPTCHA_SET[Math.floor(Math.random() * CAPTCHA_SET.length)];
};

/**
 * safeLog(guild, embed)
 * Attempts to send an embed to the configured LOG_CHANNEL in the guild.
 * Falls back to console when channel missing or sending fails.
 */
const safeLog = async (guild, embed) => {
  try {
    if (!guild || !guild.channels) {
      console.log("[verification] safeLog fallback:", embed?.data?.title || "(no title)");
      return;
    }
    const ch = await guild.channels.fetch(LOG_CHANNEL).catch(() => null);
    if (ch && ch.send) {
      await ch.send({ embeds: [embed] }).catch(() => console.warn("[verification] cannot send log embed"));
    } else {
      console.log("[verification] Log channel not found. Embed:", embed?.data?.title ?? "(no title)");
    }
  } catch (e) {
    console.error("[verification] safeLog error:", e);
  }
};

/**
 * safeReply(interaction, embedOrObject)
 * Centralized ephemeral embed reply helper (flags: 64).
 * Accepts either an EmbedBuilder, array of EmbedBuilder, or an object containing { embeds, components }.
 */
const safeReply = async (interaction, payload) => {
  try {
    if (!interaction) return;
    // allow either embed, array of embeds, or object { embeds, components }
    let replyPayload;
    if (payload && payload.embeds) {
      replyPayload = { ...payload, flags: 64 };
    } else if (Array.isArray(payload)) {
      replyPayload = { embeds: payload, flags: 64 };
    } else {
      // single embed
      replyPayload = { embeds: [payload], flags: 64 };
    }

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(replyPayload).catch(() => {});
    } else {
      return interaction.reply(replyPayload).catch(() => {});
    }
  } catch (e) {
    console.warn("[verification] safeReply failed:", e);
  }
};

/* ---------------------------
   Session management
   --------------------------- */

const startSession = (guild, userId, pick) => {
  // clear previous
  const prev = activeCaptchas.get(userId);
  if (prev && prev.timeout) clearTimeout(prev.timeout);

  const timeout = setTimeout(async () => {
    activeCaptchas.delete(userId);
    try {
      const embed = new EmbedBuilder()
        .setTitle("⚠️ Verification Expired")
        .setColor(ACTIVE_THEME.WARN_COLOR)
        .setDescription(`The verification session for <@${userId}> expired after ${VERIFICATION_PERIOD_MS / 1000} seconds.`)
        .setFooter({ text: FOOTER_LABEL })
        .setTimestamp();
      if (guild) await safeLog(guild, embed);
    } catch (e) {
      console.error("[verification] expire timeout log error", e);
    }
  }, VERIFICATION_PERIOD_MS);

  activeCaptchas.set(userId, {
    code: (pick.code || "").toLowerCase(),
    url: pick.url,
    createdAt: Date.now(),
    attempts: 0,
    timeout
  });
};

const clearSession = (userId) => {
  const s = activeCaptchas.get(userId);
  if (s && s.timeout) clearTimeout(s.timeout);
  activeCaptchas.delete(userId);
};

/* ---------------------------
   Utility: format seconds
   --------------------------- */

const secs = (ms) => Math.round(ms / 1000);

/* ---------------------------
   Full command export (complete)
   --------------------------- */

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verification")
    .setDescription("Publishes the verification panel (Developer only)"),

  async execute(interaction) {
    try {
      // Permission: only DEV_ROLE can publish
      if (!interaction.member || !interaction.member.roles.cache.has(DEV_ROLE)) {
        const embed = new EmbedBuilder()
          .setTitle("❌ Access Denied")
          .setColor(ACTIVE_THEME.ERROR_COLOR)
          .setDescription("Only authorized staff may run this command.")
          .setFooter({ text: FOOTER_LABEL })
          .setTimestamp();
        return safeReply(interaction, embed);
      }

      await interaction.deferReply({ flags: 64 }).catch(() => {});
      const guildIcon = interaction.guild?.iconURL?.({ size: 256 }) ?? null;
      const botName = interaction.client.user?.username || "Bot";

      // Panel embed: onboarding + publish info (NO captcha instructions here)
      const panelEmbed = new EmbedBuilder()
        .setTitle("🔒 Server Verification Required")
        .setColor(ACTIVE_THEME.THEME_COLOR)
        .setThumbnail(guildIcon)
        .setDescription(
          "**Welcome to our community.**\n\n" +
          "To keep the server safe and maintain quality, new users are asked to complete a short verification step.\n\n" +
          "**What to expect:**\n" +
          "- Click **Verify** to start a private verification session.\n" +
          "- You will be shown a captcha image and asked to submit the characters.\n" +
          "- Success grants the **Member** role and full access.\n\n" +
          "If you need help, press **Help**."
        )
        .setFooter({ text: FOOTER_LABEL })
        .setTimestamp();

      const panelButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("verify:start").setLabel("✅ Verify").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("verify:help").setLabel("ℹ️ Help").setStyle(ButtonStyle.Secondary)
      );

      if (!interaction.channel) {
        const errEmbed = new EmbedBuilder()
          .setTitle("❌ Invalid Context")
          .setColor(ACTIVE_THEME.ERROR_COLOR)
          .setDescription("This command must be used within a server channel.")
          .setFooter({ text: FOOTER_LABEL })
          .setTimestamp();
        return safeReply(interaction, errEmbed);
      }

      await interaction.channel.send({ embeds: [panelEmbed], components: [panelButtons] })
        .catch(err => {
          console.error("[verification] Error sending panel:", err);
          const errEmbed = new EmbedBuilder()
            .setTitle("❌ Publish Failed")
            .setColor(ACTIVE_THEME.ERROR_COLOR)
            .setDescription("Failed to publish the verification panel. Check bot permissions (Send Messages, Embed Links).")
            .setFooter({ text: FOOTER_LABEL })
            .setTimestamp();
          return safeReply(interaction, errEmbed);
        });

      const doneEmbed = new EmbedBuilder()
        .setTitle("✅ Panel Published")
        .setColor(ACTIVE_THEME.SUCCESS_COLOR)
        .setDescription("The verification panel has been published successfully.")
        .setFooter({ text: FOOTER_LABEL })
        .setTimestamp();
      return safeReply(interaction, doneEmbed);

    } catch (err) {
      console.error("[verification.execute] error:", err);
      const embed = new EmbedBuilder()
        .setTitle("❌ Unexpected Error")
        .setColor(ACTIVE_THEME.ERROR_COLOR)
        .setDescription("An unexpected error occurred while executing this command.")
        .setFooter({ text: FOOTER_LABEL })
        .setTimestamp();
      try { return safeReply(interaction, embed); } catch {}
    }
  },

  register: (client) => {
    client.on(Events.InteractionCreate, async (interaction) => {
      try {
        // BUTTONS
        if (interaction.isButton()) {
          const id = interaction.customId;
          const userId = interaction.user.id;
          const guild = interaction.guild;
          const botName = client.user?.username || "Bot";

          /* ---------------------------
             HELP button
             --------------------------- */
          if (id === "verify:help") {
            const help = new EmbedBuilder()
              .setTitle("ℹ️ Verification Guide")
              .setColor(ACTIVE_THEME.INFO_COLOR)
              .setDescription(
                "**Here’s how the verification works:**\n\n" +
                "1) Press **Verify** in the main panel.\n" +
                "2) You will receive a private captcha challenge.\n" +
                "3) Click **Answer**, type the characters shown, and submit.\n\n" +
                "**Quick tips:**\n" +
                "- Read the colored/traced characters **left → right**.\n" +
                "- Ignore decoys/extra characters.\n" +
                "- Input is **case-insensitive** (`ABC` = `abc`).\n\n" +
                "If you need further assistance, contact the server staff."
              )
              .setFooter({ text: `${FOOTER_LABEL} | ${botName}` })
              .setTimestamp();
            return safeReply(interaction, help);
          }

          /* ---------------------------
             START button
             --------------------------- */
          if (id === "verify:start") {
            // If user already has Member role -> notify
            const memberFetch = await (guild ? guild.members.fetch(userId).catch(() => null) : null);
            if (memberFetch?.roles?.cache?.has && memberFetch.roles.cache.has(MEMBER_ROLE)) {
              const alreadyEmbed = new EmbedBuilder()
                .setTitle("✅ Already Verified")
                .setColor(ACTIVE_THEME.SUCCESS_COLOR)
                .setDescription("You already have the **Member** role. No further action is required.")
                .setFooter({ text: `${FOOTER_LABEL} | ${botName}` })
                .setTimestamp();
              return safeReply(interaction, alreadyEmbed);
            }

            // Reuse existing session if active
            const existing = activeCaptchas.get(userId);
            if (existing && (Date.now() - existing.createdAt) < VERIFICATION_PERIOD_MS) {
              // compute remaining time
              const elapsed = Date.now() - existing.createdAt;
              const remainingMs = Math.max(0, VERIFICATION_PERIOD_MS - elapsed);
              const remainingS = secs(remainingMs);
              const attemptsLeft = Math.max(0, MAX_ATTEMPTS - (existing.attempts || 0));

              const resumeEmbed = new EmbedBuilder()
                .setTitle("ℹ️ Active Verification")
                .setColor(ACTIVE_THEME.WARN_COLOR)
                .setDescription("You already have an active verification session. Continue below.")
                .setImage(existing.url)
                .addFields(
                  { name: "Session Details", value: `• Time left: **${remainingS}s**\n• Attempts remaining: **${attemptsLeft}**`, inline: false }
                )
                .setFooter({ text: `${FOOTER_LABEL} | ${botName}` })
                .setTimestamp();

              const ansRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("verify:answer").setLabel("Answer").setStyle(ButtonStyle.Primary)
              );

              // ephemeral with components
              return safeReply(interaction, { embeds: [resumeEmbed], components: [ansRow] });
            }

            // Pick captcha
            const pick = pickCaptchaRandom();
            if (!pick) {
              const noCaptcha = new EmbedBuilder()
                .setTitle("❌ Configuration Error")
                .setColor(ACTIVE_THEME.ERROR_COLOR)
                .setDescription("No captchas are configured. Please notify the server administrators.")
                .setFooter({ text: FOOTER_LABEL })
                .setTimestamp();
              return safeReply(interaction, noCaptcha);
            }

            // Start session (stores code/url/timeout)
            startSession(guild, userId, pick);

            // Build the CHALLENGE embed (this is where your requested text goes)
            const sessionAttemptsLeft = MAX_ATTEMPTS;
            const challengeEmbed = new EmbedBuilder()
              .setTitle("🔒 Verification Challenge")
              .setColor(ACTIVE_THEME.THEME_COLOR)
              .setDescription(
                "**Hello! Are you human? Let's find out!**\n\n" +
                "`Please type the captcha below to be able to access this server!`\n\n" +
                "**Additional Notes:**\n" +
                "- Type out the traced colored characters from **left to right**.\n" +
                "- Ignore the decoy characters spread-around the image.\n" +
                "- You don't have to respect character cases (**upper/lower** case is ignored).\n\n" +
                "Please submit your answer using the **Answer** button below."
              )
              .setImage(pick.url)
              .addFields(
                {
                  name: "Session Details",
                  value:
                    `• **Time limit:** ${secs(VERIFICATION_PERIOD_MS)} seconds\n` +
                    `• **Attempts allowed:** ${MAX_ATTEMPTS}\n` +
                    `• **Attempts used:** 0`,
                  inline: false
                }
              )
              .setFooter({ text: `${FOOTER_LABEL} | ${botName}` })
              .setTimestamp();

            const ansRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("verify:answer").setLabel("Answer").setStyle(ButtonStyle.Primary)
            );

            // Send ephemeral challenge to the user (private)
            return safeReply(interaction, { embeds: [challengeEmbed], components: [ansRow] });
          }

          /* ---------------------------
             ANSWER button (shows modal)
             --------------------------- */
          if (id === "verify:answer") {
            const session = activeCaptchas.get(userId);
            if (!session || (Date.now() - session.createdAt) > VERIFICATION_PERIOD_MS) {
              clearSession(userId);
              const expiredEmbed = new EmbedBuilder()
                .setTitle("⚠️ Session Expired")
                .setColor(ACTIVE_THEME.WARN_COLOR)
                .setDescription("Your verification session has expired. Please press Verify to start again.")
                .setFooter({ text: FOOTER_LABEL })
                .setTimestamp();
              return safeReply(interaction, expiredEmbed);
            }

            const modal = new ModalBuilder().setCustomId("verify:modal").setTitle("Enter Captcha");
            const input = new TextInputBuilder()
              .setCustomId("verify:input")
              .setLabel("Captcha code")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(20);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
          }
        } // end isButton

        /* ---------------------------
           Modal submit handling
           --------------------------- */
        if (interaction.isModalSubmit() && interaction.customId === "verify:modal") {
          const userId = interaction.user.id;
          const guild = interaction.guild;
          const session = activeCaptchas.get(userId);
          const botName = client.user?.username || "Bot";

          // If no session
          if (!session) {
            const expiredEmbed = new EmbedBuilder()
              .setTitle("⚠️ Session Not Found")
              .setColor(ACTIVE_THEME.WARN_COLOR)
              .setDescription("No active verification session was found. Please press Verify to start a new session.")
              .setFooter({ text: FOOTER_LABEL })
              .setTimestamp();
            return safeReply(interaction, expiredEmbed);
          }

          // If session timed out
          if ((Date.now() - session.createdAt) > VERIFICATION_PERIOD_MS) {
            clearSession(userId);
            const expiredEmbed = new EmbedBuilder()
              .setTitle("⚠️ Session Expired")
              .setColor(ACTIVE_THEME.WARN_COLOR)
              .setDescription("Your verification session has expired. Please start a new session.")
              .setFooter({ text: FOOTER_LABEL })
              .setTimestamp();
            return safeReply(interaction, expiredEmbed);
          }

          // Obtain answer
          const answerRaw = interaction.fields.getTextInputValue("verify:input");
          const answer = (answerRaw || "").trim().toLowerCase();

          // CORRECT
          if (answer === session.code) {
            clearSession(userId);

            try {
              const member = await guild.members.fetch(userId).catch(() => null);
              const role = guild.roles.cache.get(MEMBER_ROLE);
              if (!role) {
                const roleMissing = new EmbedBuilder()
                  .setTitle("❌ Role Missing")
                  .setColor(ACTIVE_THEME.ERROR_COLOR)
                  .setDescription("The configured Member role was not found in this server. Please contact staff.")
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                // Log
                const embed = new EmbedBuilder()
                  .setTitle("Role Missing (Log)")
                  .setColor(ACTIVE_THEME.ERROR_COLOR)
                  .setDescription(`Member role ${MEMBER_ROLE} not found in guild ${guild?.id}.`)
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                await safeLog(guild, embed);
                return safeReply(interaction, roleMissing);
              }

              const botMember = guild.members.me;
              if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                const permEmbed = new EmbedBuilder()
                  .setTitle("❌ Permission Required")
                  .setColor(ACTIVE_THEME.ERROR_COLOR)
                  .setDescription("Bot requires Manage Roles permission to assign roles. Please contact an administrator.")
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                const embed = new EmbedBuilder()
                  .setTitle("Permission Missing (Log)")
                  .setColor(ACTIVE_THEME.ERROR_COLOR)
                  .setDescription("Bot missing ManageRoles permission.")
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                await safeLog(guild, embed);
                return safeReply(interaction, permEmbed);
              }

              if (botMember.roles.highest.position <= role.position) {
                const posEmbed = new EmbedBuilder()
                  .setTitle("❌ Role Hierarchy Issue")
                  .setColor(ACTIVE_THEME.ERROR_COLOR)
                  .setDescription("Bot's role must be higher than the Member role to assign it. Adjust role hierarchy.")
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                const embed = new EmbedBuilder()
                  .setTitle("Role Position Error (Log)")
                  .setColor(ACTIVE_THEME.ERROR_COLOR)
                  .setDescription("Bot cannot assign the Member role due to role hierarchy.")
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                await safeLog(guild, embed);
                return safeReply(interaction, posEmbed);
              }

              // Assign role
              await member.roles.add(role).catch(async (err) => {
                console.error("[verification] add role error:", err);
                const errEmbed = new EmbedBuilder()
                  .setTitle("❌ Role Assignment Failed")
                  .setColor(ACTIVE_THEME.ERROR_COLOR)
                  .setDescription("Failed to assign the Member role. Please inform server staff.")
                  .addFields(
                    { name: "Guild", value: `${guild?.name || guild?.id}`, inline: true },
                    { name: "Member", value: `${interaction.user.tag}`, inline: true }
                  )
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                await safeLog(guild, errEmbed);
                throw err;
              });

              // DM success (embed with guild icon)
              try {
                const guildIcon = guild?.iconURL?.({ size: 256 }) ?? null;
                const dmEmbed = new EmbedBuilder()
                  .setTitle("✅ Verification Complete")
                  .setColor(ACTIVE_THEME.SUCCESS_COLOR)
                  .setThumbnail(guildIcon)
                  .setDescription(`You have successfully completed verification in **${guild.name}**. Welcome!`)
                  .addFields(
                    { name: "Note", value: "If you experience any issues, contact the server staff.", inline: false }
                  )
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {});
              } catch {}

              // Log success for admins
              const successEmbed = new EmbedBuilder()
                .setTitle("✅ Verification Completed")
                .setColor(ACTIVE_THEME.SUCCESS_COLOR)
                .setThumbnail(interaction.user.displayAvatarURL?.({ size: 128 }))
                .addFields(
                  { name: "User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                  { name: "Result", value: "Successful", inline: true },
                  { name: "Duration (s)", value: `${secs(Date.now() - session.createdAt)}`, inline: true }
                )
                .setFooter({ text: FOOTER_LABEL })
                .setTimestamp();
              await safeLog(guild, successEmbed);

              // Ephemeral reply to user
              const clientEmbed = new EmbedBuilder()
                .setTitle("✅ Verification Successful")
                .setColor(ACTIVE_THEME.SUCCESS_COLOR)
                .setDescription("You have been verified and granted access.")
                .setFooter({ text: FOOTER_LABEL })
                .setTimestamp();
              return safeReply(interaction, clientEmbed);

            } catch (err) {
              console.error("[verification] Error assigning role:", err);
              const errEmbed = new EmbedBuilder()
                .setTitle("❌ Role Assignment Error")
                .setColor(ACTIVE_THEME.ERROR_COLOR)
                .setDescription("An error occurred while assigning the Member role. Please contact server staff.")
                .setFooter({ text: FOOTER_LABEL })
                .setTimestamp();
              return safeReply(interaction, errEmbed);
            }
          } // end correct branch

          // INCORRECT: increment attempts and keep same captcha (no regen)
          session.attempts = (session.attempts || 0) + 1;

          // Build detailed failure log
          const failEmbed = new EmbedBuilder()
            .setTitle("❌ Verification Attempt Failed")
            .setColor(ACTIVE_THEME.ERROR_COLOR)
            .setThumbnail(interaction.user.displayAvatarURL?.({ size: 128 }))
            .setDescription(`${interaction.user.tag} failed attempt ${session.attempts}/${MAX_ATTEMPTS}.`)
            .addFields(
              { name: "Guild", value: `${guild?.name || guild?.id}`, inline: true },
              { name: "Channel", value: `${interaction.channel?.name || interaction.channel?.id || "DM"}`, inline: true },
              { name: "Session age (s)", value: `${secs(Date.now() - session.createdAt)}`, inline: true }
            )
            .setImage(session.url)
            .setFooter({ text: FOOTER_LABEL })
            .setTimestamp();
          await safeLog(guild, failEmbed);

          // If reached MAX_ATTEMPTS -> try to kick if possible
          if (session.attempts >= MAX_ATTEMPTS) {
            clearSession(userId);

            try {
              const member = await guild.members.fetch(userId).catch(() => null);
              const botMember = guild.members.me;
              if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
                const warnEmbed = new EmbedBuilder()
                  .setTitle("⚠️ Kick Not Performed")
                  .setColor(ACTIVE_THEME.WARN_COLOR)
                  .setDescription(`Bot lacks KickMembers permission; could not remove ${interaction.user.tag}.`)
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                await safeLog(guild, warnEmbed);
              } else if (member) {
                await member.kick("Exceeded verification attempts").catch((kickErr) => {
                  console.warn("[verification] Kick error:", kickErr);
                });

                // DM to user informing removal (embed)
                try {
                  const guildIcon = guild?.iconURL?.({ size: 256 }) ?? null;
                  const dmKick = new EmbedBuilder()
                    .setTitle("❌ Removed from Server")
                    .setColor(ACTIVE_THEME.ERROR_COLOR)
                    .setThumbnail(guildIcon)
                    .setDescription(`You have been removed from **${guild.name}** after exceeding the maximum number of verification attempts.`)
                    .setFooter({ text: FOOTER_LABEL })
                    .setTimestamp();
                  await interaction.user.send({ embeds: [dmKick] }).catch(() => {});
                } catch {}

                const kickEmbed = new EmbedBuilder()
                  .setTitle("❌ Member Removed")
                  .setColor(ACTIVE_THEME.ERROR_COLOR)
                  .setDescription(`${interaction.user.tag} was removed after ${MAX_ATTEMPTS} failed verification attempts.`)
                  .setFooter({ text: FOOTER_LABEL })
                  .setTimestamp();
                await safeLog(guild, kickEmbed);
              }
            } catch (kickErr) {
              console.warn("[verification] Kick handling error:", kickErr);
              const errEmbed = new EmbedBuilder()
                .setTitle("❌ Kick Error")
                .setColor(ACTIVE_THEME.ERROR_COLOR)
                .setDescription(`Failed to remove ${interaction.user.tag}. Check bot permissions and role hierarchy.`)
                .setFooter({ text: FOOTER_LABEL })
                .setTimestamp();
              await safeLog(guild, errEmbed);
            }

            const finalEmbed = new EmbedBuilder()
              .setTitle("❌ Verification Failed")
              .setColor(ACTIVE_THEME.ERROR_COLOR)
              .setDescription(`You have exceeded the maximum number of attempts. Action was taken if the bot had the required permissions.`)
              .setFooter({ text: FOOTER_LABEL })
              .setTimestamp();
            return safeReply(interaction, finalEmbed);
          }

          // Otherwise: reset session timeout and re-send same captcha with session details
          if (session.timeout) clearTimeout(session.timeout);
          const newTimeout = setTimeout(async () => {
            activeCaptchas.delete(userId);
            const expireEmbed = new EmbedBuilder()
              .setTitle("⚠️ Verification Expired")
              .setColor(ACTIVE_THEME.WARN_COLOR)
              .setDescription(`Verification session for <@${userId}> expired after ${VERIFICATION_PERIOD_MS / 1000} seconds.`)
              .setFooter({ text: FOOTER_LABEL })
              .setTimestamp();
            await safeLog(guild, expireEmbed);
          }, VERIFICATION_PERIOD_MS);

          activeCaptchas.set(userId, {
            code: session.code,
            url: session.url,
            createdAt: Date.now(),
            attempts: session.attempts,
            timeout: newTimeout
          });

          const attemptsLeft = Math.max(0, MAX_ATTEMPTS - session.attempts);
          const retryEmbed = new EmbedBuilder()
            .setTitle("⚠️ Incorrect Captcha")
            .setColor(ACTIVE_THEME.WARN_COLOR)
            .setDescription("The code entered is incorrect. Please review the image and try again.")
            .setImage(session.url)
            .addFields(
              { name: "Session Details", value: `• Attempts used: **${session.attempts}/${MAX_ATTEMPTS}**\n• Attempts remaining: **${attemptsLeft}**\n• Time limit: **${secs(VERIFICATION_PERIOD_MS)}s**`, inline: false }
            )
            .setFooter({ text: FOOTER_LABEL })
            .setTimestamp();

          const answerRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("verify:answer").setLabel("Answer").setStyle(ButtonStyle.Primary)
          );

          return safeReply(interaction, { embeds: [retryEmbed], components: [answerRow] });
        } // end interaction create try
      } catch (err) {
        console.error("[verification] interaction handler error:", err);
        try {
          if (interaction && !interaction.replied) {
            const errEmbed = new EmbedBuilder()
              .setTitle("❌ Processing Error")
              .setColor(ACTIVE_THEME.ERROR_COLOR)
              .setDescription("An unexpected error occurred while processing verification. Please try again later or contact staff.")
              .setFooter({ text: FOOTER_LABEL })
              .setTimestamp();
            await safeReply(interaction, errEmbed);
          }
        } catch {}
      }
    }); // client.on
  } // register
}; // module.exports
