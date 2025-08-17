// index.js
import { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import "dotenv/config";
import fs from "fs";

// JSONファイル作成
if (!fs.existsSync("questions.json")) fs.writeFileSync("questions.json", "[]");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// 通知用チャンネルID（.envで設定）
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID;

client.once(Events.ClientReady, () => {
  console.log(`✅ ログインしました: ${client.user.tag}`);
});

// 質問データ読み込み
const loadQuestions = () => JSON.parse(fs.readFileSync("questions.json", "utf8"));
const saveQuestions = data => fs.writeFileSync("questions.json", JSON.stringify(data, null, 2));

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ------------------------
  // 質問登録 (/question)
  // ------------------------
  if (interaction.commandName === "question") {
    const content = interaction.options.getString("内容");
    const questions = loadQuestions();
    questions.push({ content, author: interaction.user.tag, answered: false });
    saveQuestions(questions);

    const embed = new EmbedBuilder()
      .setTitle("✏️ 新しい質問を受け付けました！")
      .setDescription(`> ${content}`)
      .addFields({ name: "質問者", value: `**${interaction.user.tag}**` })
      .setColor(0x00ff00)
      .setFooter({ text: "質問管理Bot" })
      .setTimestamp();

    await interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [embed] });

    // 通知チャンネルに投稿
    if (NOTIFY_CHANNEL_ID) {
      const notifyChannel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
      await notifyChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });
    }
  }

  // ------------------------
  // 質問一覧 (/list)
  // ------------------------
  else if (interaction.commandName === "list") {
    const questions = loadQuestions();
    if (questions.length === 0) {
      await interaction.reply("質問はまだありません。");
      return;
    }

    const modeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("all_list").setLabel("一覧表示モード").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("single_list").setLabel("1件ずつ表示モード").setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ content: "表示モードを選択してください", components: [modeRow] });
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async i => {
      if (i.customId === "all_list") {
        const questions = loadQuestions();
        const embed = new EmbedBuilder().setTitle("📋 質問一覧").setColor(0x0099ff);
        questions.forEach((q, idx) => {
          if (q.answered) {
            embed.addFields({
              name: `${idx + 1}. ✅ ${q.content}`,
              value: `> **回答:**\n\`\`\`${q.answer}\`\`\`\n**回答者:** ${q.answeredBy}`
            });
          } else {
            embed.addFields({
              name: `${idx + 1}. ❌ ${q.content}`,
              value: `> **質問者:** ${q.author}`
            });
          }
        });
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("all_list").setLabel("一覧表示モード").setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId("single_list").setLabel("1件ずつ表示モード").setStyle(ButtonStyle.Primary).setDisabled(true)
        );
        await i.update({ content: null, embeds: [embed], components: [disabledRow] });
      } 
      else if (i.customId === "single_list") {
        let currentIndex = 0;
        const getEmbed = idx => {
          const questions = loadQuestions();
          const q = questions[idx];
          const embed = new EmbedBuilder()
            .setTitle(`質問 ${idx + 1}/${questions.length}`)
            .setDescription(`> ${q.content}`);
          if (q.answered) {
            embed.addFields(
              { name: "回答", value: `\`\`\`${q.answer}\`\`\`` },
              { name: "回答者", value: `**${q.answeredBy}**` }
            );
          } else {
            embed.addFields({ name: "質問者", value: `**${q.author}**` });
          }
          embed.setColor(0x0099ff);
          return embed;
        };

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("prev").setLabel("戻る").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("next").setLabel("次へ").setStyle(ButtonStyle.Primary)
        );

        await i.update({ content: null, embeds: [getEmbed(currentIndex)], components: [row] });

        const singleCollector = i.message.createMessageComponentCollector({ time: 60000 });
        const interval = setInterval(async () => {
          const questions = loadQuestions();
          if (questions.length === 0) return;
          await i.message.edit({ embeds: [getEmbed(currentIndex)], components: [row] });
        }, 30000);

        singleCollector.on("collect", async btn => {
          const questions = loadQuestions();
          if (btn.customId === "next") currentIndex = (currentIndex + 1) % questions.length;
          if (btn.customId === "prev") currentIndex = (currentIndex - 1 + questions.length) % questions.length;
          await btn.update({ embeds: [getEmbed(currentIndex)], components: [row] });
        });

        singleCollector.on("end", async () => {
          clearInterval(interval);
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("prev").setLabel("戻る").setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId("next").setLabel("次へ").setStyle(ButtonStyle.Primary).setDisabled(true)
          );
          await i.message.edit({ components: [disabledRow] });
        });
      }
    });

    collector.on("end", async () => {
      const disabledMode = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("all_list").setLabel("一覧表示モード").setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId("single_list").setLabel("1件ずつ表示モード").setStyle(ButtonStyle.Primary).setDisabled(true)
      );
      await message.edit({ components: [disabledMode] });
    });
  }

  // ------------------------
  // 回答 (/answer)
  // ------------------------
  else if (interaction.commandName === "answer") {
    const number = interaction.options.getInteger("番号") - 1;
    const answer = interaction.options.getString("答え");
    const questions = loadQuestions();
    if (!questions[number]) {
      await interaction.reply("その番号の質問は存在しません。");
      return;
    }
    questions[number].answered = true;
    questions[number].answer = answer;
    questions[number].answeredBy = interaction.user.tag;
    saveQuestions(questions);

    const embed = new EmbedBuilder()
      .setTitle("✅ 質問に回答しました")
      .setDescription(`> ${questions[number].content}`)
      .addFields(
        { name: "回答", value: `\`\`\`${answer}\`\`\`` },
        { name: "回答者", value: `**${interaction.user.tag}**` },
        { name: "質問番号", value: `${number + 1}` }
      )
      .setColor(0xffa500)
      .setFooter({ text: "質問管理Bot" })
      .setTimestamp();

    await interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [embed] });

    // 通知チャンネルに回答投稿
    if (NOTIFY_CHANNEL_ID) {
      const notifyChannel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
      await notifyChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });
    }
  }

  // ------------------------
  // 検索 (/search)
  // ------------------------
  else if (interaction.commandName === "search") {
    const keyword = interaction.options.getString("キーワード");
    const questions = loadQuestions();
    const results = questions.map((q, idx) => ({ ...q, index: idx + 1 }))
                             .filter(q => q.content.includes(keyword));
    if (results.length === 0) {
      await interaction.reply(`キーワード「${keyword}」に該当する質問はありません。`);
      return;
    }

    const embed = new EmbedBuilder().setTitle(`🔍 「${keyword}」検索結果`).setColor(0x00ffff);
    results.forEach(q => {
      embed.addFields({
        name: `${q.index}. ${q.answered ? "✅" : "❌"} ${q.content}`,
        value: q.answered ? `> **回答:** ${q.answer}\n**回答者:** ${q.answeredBy}` : `> **質問者:** ${q.author}`
      });
    });
    await interaction.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
