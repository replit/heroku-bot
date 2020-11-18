const app = require("express")();
const heroku = require('./heroku');
const slack = require('./slack')
const bodyParser = require("body-parser");

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Render a webpage with the latest diff
app.get("/", (req, res) => {
  commits().then((url) => res.send(`<a href=${url}>${url}</a>`));
});


app.get("/check", async (req, res) => {
  await checkUndeployed();

  res.send("checked pending");
});

// Webhook hit by heroku when staging deploys
app.post("/staging_deploy", async (req, res) => {
	heroku.notifyUndeployed();

  res.end("gotcha");

  return;
});

// Post catchall is heroku commit slack bot
app.post("*", slack.slashCommits);

app.listen(3000, () => console.log("server started"));
