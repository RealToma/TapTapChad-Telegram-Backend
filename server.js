const express = require("express");
const bodyParser = require("body-parser");
const logger = require("morgan");
const app = express();
const cors = require("cors");
const db = require("./queries");
const Pool = require("pg").Pool;
const schedule = require("node-schedule");
require("dotenv").config();

const rule = new schedule.RecurrenceRule();
// rule.hour = 0;
rule.minute = 0;
rule.second = 0;
rule.tz = "America/Toronto";

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

const http = require("http").createServer(app);

app.use(cors());
app.use(express.json());
const API_PORT = process.env.PORT || 3003;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(logger("dev"));

app.get("/users", db.getUsers);
app.get("/tasks", db.getTasks);
app.get("/users/:id", db.getUserById);
app.post("/friends", db.getFriends);
app.post("/users", db.createUser);
app.post("/bonus", db.bonus);
app.post("/sendInvite", db.sendInvite);
app.post("/connect", db.connect);
app.put("/users", db.updateUser);

app.get("/", (req, res) => {
  res.send("Express on Vercel, yay");
});

http.listen(API_PORT, () => {
  console.log(`LISTENING ON PORT ${API_PORT}`);
});

const { Bot, InlineKeyboard } = require("grammy");
const botToken = process.env.BOT_TOKEN;
const bot = new Bot(botToken);

bot.command("start", async (ctx) => {
  const userid = ctx.from.username; // Get the Telegram user ID
  const receiveid = ctx.match;
  pool.query(
    "SELECT * FROM users WHERE tgid = $1",
    [userid],
    async (error, results1) => {
      if (error) {
        throw error;
      }
      let user = results1.rows[0];
      console.log("ctx.match", receiveid);
      console.log("user", user);
      if (!user && receiveid) {
        pool.query(
          "INSERT INTO users (tgid, mount, friendid) VALUES ($1, $2, $3)",
          [userid, ctx.from.is_premium === true ? 10000 : 5000, receiveid],
          async (error) => {
            if (error) throw error;
            pool.query(
              "SELECT * FROM users WHERE tgid = $1",
              [receiveid],
              (error, results2) => {
                if (error) throw error;
                let sender = results2.rows[0];
                if (sender)
                  sender.mount += ctx.from.is_premium === true ? 10000 : 5000;
                else {
                  pool.query(
                    "UPDATE users SET mount = $1 WHERE tgid = $2",
                    [
                      results2.rows[0].mount + ctx.from.is_premium === true
                        ? 10000
                        : 5000,
                      receiveid,
                    ],
                    (error) => {
                      if (error) {
                        throw error;
                      }
                      return response.json({ user });
                    }
                  );
                }
              }
            );
          }
        );
      }
      const menus = new InlineKeyboard().webApp(
        "Play in 1 click",
        `https://fatso-fe.vercel.app/?user=${encodeURIComponent(userid)}`
      );
      await ctx.replyWithPhoto(
        "https://pbs.twimg.com/media/GPyTWnKXEAAb7fE?format=jpg&name=large",
        {
          reply_markup: menus,
          parse_mode: "HTML",
          caption: `Hello, @${userid}! Welcome to Fatso Family.`,
        }
      );
    }
  );
});

bot.on("callback_query:data", async (ctx) => {
  const userid = ctx.from.username; // Get the Telegram user ID
  const data = ctx.callbackQuery.data;
  switch (data) {
    case "howToEarn":
      const menus = new InlineKeyboard().webApp(
        "Play in 1 click",
        `https://fatso-fe.vercel.app/?user=${encodeURIComponent(userid)}`
      );
      await ctx.reply(
        "How to play VWS Worlds ⚡️\n\nFull version of the guide.\n\n💰 Tap to earn\nTap the screen and collect coins.\n\n⛏ Mine\nUpgrade cards that will give you passive income.\n\n⏰ Profit per hour\nThe exchange will work for you on its own, even when you are not in the game for 3 hours.\nThen you need to log in to the game again.\n\n📈 LVL\nThe more coins you have on your balance, the higher the level of your exchange is and the faster you can earn more coins.\n\n👥 Friends\nInvite your friends and you’ll get bonuses. Help a friend move to the next leagues and you'll get even more bonuses.\n\n/help to get this guide",
        {
          reply_markup: menus,
          parse_mode: "HTML",
        }
      );
    default:
      break;
  }
});

(async () => {
  await bot.api.deleteWebhook();
  bot.start();
})();

const getLevelInfo = (count) => {
  switch (Math.floor(count / 200000)) {
    case 0:
      return { text: "Bronze", number: 1 };
    case 1:
      return { text: "Silver", number: 2 };
    case 2:
      return { text: "Platinum", number: 3 };
    case 3:
      return { text: "Diamond", number: 4 };
    case 4:
      return { text: "Master", number: 5 };
    case 5:
      return { text: "Grandmaster", number: 6 };
    case 6:
      return { text: "Elite", number: 7 };
    case 7:
      return { text: "Legendary", number: 8 };
    case 8:
      return { text: "Mythic", number: 9 };
    default:
      return { text: "Mythic", number: 9 };
  }
};

schedule.scheduleJob(rule, async function () {
  console.log("start reward");
  pool.query("SELECT * FROM users ORDER BY id ASC", (error, results) => {
    if (error) throw error;
    let statements = results.rows
      .map((x) => {
        rewardPerHour = getLevelInfo(x.mount).number * 20;
        return `WHEN '${x.tgid}' THEN mount + ${rewardPerHour}`;
      })
      .join(" ");
    let users = results.rows
      .map((x) => {
        rewardPerHour = getLevelInfo(x.mount).number * 20;
        return `'${x.tgid}'`;
      })
      .join(", ");
    console.log("state", statements, users);
    pool.query(
      `UPDATE users SET mount = CASE tgid ${statements} END WHERE tgid IN (${users})`,
      [],
      (error) => {
        if (error) {
          throw error;
        }
        console.log("reward updated");
      }
    );
  });
});
