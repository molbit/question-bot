import { REST, Routes, SlashCommandBuilder } from "discord.js";
import "dotenv/config";

const commands = [
  new SlashCommandBuilder()
    .setName("question")
    .setDescription("質問を投稿します")
    .addStringOption(option =>
      option.setName("内容")
            .setDescription("質問内容を入力")
            .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("list")
    .setDescription("質問一覧を表示します"),
  new SlashCommandBuilder()
    .setName("answer")
    .setDescription("質問に回答します")
    .addIntegerOption(option =>
      option.setName("番号")
            .setDescription("質問番号")
            .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("答え")
            .setDescription("回答内容")
            .setRequired(true)
    ),
  new SlashCommandBuilder()   // ←ここ追加
    .setName("search")
    .setDescription("キーワードで質問を検索します")
    .addStringOption(option =>
      option.setName("キーワード")
            .setDescription("検索したいキーワードを入力")
            .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 コマンド登録中...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), // GUILD_ID はサーバーID
      { body: commands }
    );
    console.log("✅ コマンド登録完了！");
  } catch (error) {
    console.error(error);
  }
})();