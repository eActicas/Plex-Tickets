const c = require("express");
const d = require("passport");
const e = require("express-session");
const f = require("passport-discord").Strategy;
const g = require("ejs");
const h = require("path");
const i = require("body-parser");
const j = require("cookie-parser");
const k = c();
const {
  Discord: l,
  ChannelType: m
} = require("discord.js");
const n = require("fs");
const o = require("js-yaml");
const p = o.load(n.readFileSync("./config.yml", "utf8"));
const q = o.load(n.readFileSync("./addons/Dashboard/config.yml", "utf8"));
const r = require("../../models/guildModel");
const s = require("../../models/ticketModel");
const t = require("../../models/reviewsModel");
const u = require("../../models/dashboardModel");
const v = q.Port;
module.exports.run = async a => {
  a.once("ready", async () => {
    const a = await u.findOne({
      guildID: p.GuildID
    });
    if (!a || a?.length == 0) {
      const a = new u({
        guildID: p.GuildID,
        url: q.URL,
        port: v
      });
      await a.save();
    } else if (a) {
      a.url = q.URL;
      a.port = v;
      await a.save();
    }
  });
  const b = h.basename(__dirname);
  if (b !== "Dashboard") {
    console.log("[31m%s[0m", "[DASHBOARD] The folder name for the Dashboard addon needs to be named \"Dashboard\" or it won't function! Rename it and restart the bot.");
    console.log("[31m%s[0m", "[DASHBOARD] The folder name for the Dashboard addon needs to be named \"Dashboard\" or it won't function! Rename it and restart the bot.");
    console.log("[31m%s[0m", "[DASHBOARD] The folder name for the Dashboard addon needs to be named \"Dashboard\" or it won't function! Rename it and restart the bot.");
    return;
  }
  k.use(e({
    secret: q.secretKey,
    resave: true,
    saveUninitialized: true
  }));
  k.use(j());
  k.use(c.json());
  k.use(c.urlencoded({
    extended: true
  }));
  k.use(d.initialize());
  k.use(d.session());
  k.use(i.json());
  d.use(new f({
    clientID: q.clientID,
    clientSecret: q.clientSecret,
    callbackURL: q.callbackURL,
    scope: ["identify", "guilds"]
  }, (a, b, c, d) => {
    return d(null, c);
  }));
  d.serializeUser((a, b) => {
    b(null, a);
  });
  d.deserializeUser((a, b) => {
    b(null, a);
  });
  k.set("view engine", "ejs");
  k.set("views", __dirname + "/views");
  const g = h.join(__dirname, "public");
  k.use(c.static(g));
  const l = h.join(__dirname, "..", "..", "package.json");
  const o = JSON.parse(n.readFileSync(l, "utf8"));
  const w = o.version;
  k.locals.discordBotVersion = w;
  const x = h.join(__dirname, "version.json");
  const y = JSON.parse(n.readFileSync(x, "utf8"));
  const z = y.dashboardVersion;
  k.locals.dashboardVersion = z;
  const A = b => {
    return async (c, d, e) => {
      if (c.isAuthenticated()) {
        try {
          const d = a.guilds.cache.get(p.GuildID);
          if (d && d.members) {
            const a = await d.members.fetch(c.user.id);
            if (a && a.roles) {
              const c = a.roles.cache.map(a => a.id);
              const d = b.some(a => c.includes(a));
              if (d) {
                return e();
              }
            }
          }
        } catch (a) {
          console.error("Error fetching guild or member from Discord API:", a);
        }
      }
      return d.status(403).render("permission-denied");
    };
  };
  const B = async (b, c, d) => {
    if (b.isAuthenticated()) {
      try {
        const c = a.guilds.cache.get(p.GuildID);
        if (c && c.members) {
          const a = await c.members.fetch(b.user.id);
          if (a && a.roles) {
            const b = a.roles.cache.map(a => a.id);
            const c = q.AccessDashboard.some(a => b.includes(a));
            if (c) {
              return d();
            }
          }
        }
      } catch (a) {}
    }
    c.cookie("redirectAfterLogin", b.originalUrl);
    c.redirect("/login");
  };
  const C = async (a, b, c) => {
    if (a.isAuthenticated()) {
      return c();
    } else {
      b.cookie("redirectAfterLogin", a.originalUrl);
      b.redirect("/login");
    }
  };
  k.get("/auth/discord/callback", d.authenticate("discord", {
    failureRedirect: "/login"
  }), (a, b) => {
    const c = a.cookies.redirectAfterLogin || "/";
    b.redirect(c);
  });
  k.get("/auth", d.authenticate("discord"));
  k.get("/home", B, A(q.Pages.Home), async (a, b) => {
    try {
      const c = await r.findOne({
        guildID: p.GuildID
      });
      const d = c.reviews.map(a => a.rating);
      const e = d.filter(a => a !== 0);
      const f = e.length ? (e.reduce((a, b) => a + b) / e.length).toFixed(1) : "0.0";
      b.render("home", {
        user: a.user,
        guildStats: c,
        averageRating: f,
        config: q
      });
    } catch (c) {
      console.error("Error fetching data from MongoDB:", c);
      b.render("home", {
        user: a.user,
        guildStats: null,
        averageRating: "0.0"
      });
    }
  });
  const D = require("../../models/weeklyStatsModel");
  k.get("/api/weeklyStats", B, async (a, b) => {
    try {
      const a = await D.findOne({}, {
        _id: 0,
        __v: 0
      }).sort({
        weekStartDate: -1
      }).limit(1);
      if (!a) {
        b.json([]);
        return;
      }
      const c = {
        weekStartDate: a.weekStartDate,
        dailyMetrics: a.dailyMetrics.map(a => {
          return {
            timestamp: a.timestamp,
            totalTickets: a.totalTickets,
            ticketsClosed: a.ticketsClosed
          };
        })
      };
      b.json([c]);
    } catch (a) {
      console.error("Error fetching weekly stats:", a);
      b.status(500).json({
        error: "Internal Server Error"
      });
    }
  });
  k.get("/weeklyStatsPage", B, async (a, b) => {
    try {
      const a = await D.findOne({}, {
        _id: 0,
        __v: 0
      }).sort({
        weekStartDate: -1
      }).limit(1);
      if (!a) {
        b.json([]);
        return;
      }
      const c = {
        weekStartDate: a.weekStartDate,
        dailyMetrics: a.dailyMetrics.map(a => {
          return {
            timestamp: a.timestamp,
            totalTickets: a.totalTickets,
            ticketsClosed: a.ticketsClosed,
            totalSuggestions: a.totalSuggestions,
            totalSuggestionUpvotes: a.totalSuggestionUpvotes,
            totalSuggestionDownvotes: a.totalSuggestionDownvotes,
            totalReviews: a.totalReviews,
            totalMessages: a.totalMessages,
            usersJoined: a.usersJoined,
            usersLeft: a.usersLeft,
            newBans: a.newBans,
            newRoles: a.newRoles
          };
        })
      };
      b.json([c]);
    } catch (a) {
      console.error("Error fetching weekly stats:", a);
      b.status(500).json({
        error: "Internal Server Error"
      });
    }
  });
  k.get("/statistics", B, A(q.Pages.Stats), async (b, c) => {
    try {
      const d = await r.findOne({
        guildID: p.GuildID
      });
      const e = a.guilds.cache.get(p.GuildID);
      const f = d.reviews.map(a => a.rating);
      const g = f.filter(a => a !== 0);
      const h = g.length ? (g.reduce((a, b) => a + b) / g.length).toFixed(1) : "0.0";
      c.render("statistics", {
        user: b.user,
        guildStats: d,
        averageRating: h,
        guild: e
      });
    } catch (a) {
      console.error("Error fetching data from MongoDB:", a);
      c.render("statistics", {
        user: b.user,
        guildStats: null,
        averageRating: "0.0"
      });
    }
  });
  async function E(b) {
    try {
      const c = await a.users.fetch(b);
      const d = c.avatar ? c.avatarURL() : "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Faenza-avatar-default-symbolic.svg/2048px-Faenza-avatar-default-symbolic.svg.png";
      return {
        username: c.username,
        avatarURL: d
      };
    } catch (a) {
      return {
        username: "Unknown",
        avatarURL: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Faenza-avatar-default-symbolic.svg/2048px-Faenza-avatar-default-symbolic.svg.png"
      };
    }
  }
  async function F(b, c) {
    try {
      const d = await a.guilds.fetch(c);
      const e = await d.members.fetch(b);
      const f = e.roles.cache.map(a => a.id);
      return f;
    } catch (a) {
      console.error("Error fetching user roles:", a);
      return [];
    }
  }
  k.get("/reviews", B, A(q.Pages.Reviews), async (a, b) => {
    try {
      const c = await t.find({
        rating: {
          $gte: 1
        }
      });
      const d = await Promise.all(c.map(async a => {
        const b = await E(a.userID);
        return {
          ...a._doc,
          userInfo: b
        };
      }));
      const e = a.query.sort || "recent";
      const f = a => a.updatedAt || a.createdAt;
      switch (e) {
        case "lowToHigh":
          d.sort((a, b) => a.rating - b.rating);
          break;
        case "highToLow":
          d.sort((a, b) => b.rating - a.rating);
          break;
        case "recent":
          d.sort((a, b) => {
            if (f(a) && f(b)) {
              return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
            } else if (f(a)) {
              return -1;
            } else if (f(b)) {
              return 1;
            } else {
              return 0;
            }
          });
          break;
        default:
          break;
      }
      const g = await F(a.user.id, p.GuildID);
      b.render("reviews", {
        user: a.user,
        reviews: d,
        req: a,
        sortOption: e,
        userRoles: g,
        config: q
      });
    } catch (c) {
      console.error("Error fetching reviews data:", c);
      b.render("reviews", {
        user: a.user,
        reviews: [],
        req: a
      });
    }
  });
  k.delete("/reviews/delete/:reviewId", B, async (a, b) => {
    const c = a.params.reviewId;
    try {
      const d = await F(a.user.id, p.GuildID);
      if (!d.some(a => q.Actions.DeleteReviews.includes(a))) {
        return b.status(403).json({
          error: "Permission denied"
        });
      }
      const e = await t.findByIdAndDelete(c);
      if (!e) {
        return b.status(404).json({
          error: "Review not found"
        });
      }
      b.status(204).send();
    } catch (a) {
      console.error("Error deleting review:", a);
      b.status(500).json({
        error: "Internal server error"
      });
    }
  });
  k.get("/transcript", C, async (b, c) => {
    try {
      const {
        channelId: d,
        dateNow: e
      } = b.query;
      if (!d || !e) {
        return c.status(400).send("Missing required parameters");
      }
      const f = "transcript-" + d + "-" + e + ".html";
      const g = h.join(__dirname, "transcripts", f);
      n.access(g, n.constants.F_OK, async e => {
        if (e) {
          return c.status(404).send("Transcript not found");
        }
        try {
          const e = await s.findOne({
            channelID: d
          });
          if (!e) {
            return c.status(404).send("Ticket not found");
          }
          const f = await a.users.cache.get(e.userID);
          const h = a.guilds.cache.get(p.GuildID);
          const i = h.members.cache.get(b.user.id);
          const j = q.Actions.ViewTranscripts;
          const k = f && f.id && b.user.id === f.id || i && i.roles && j.some(a => i.roles.cache.has(a));
          if (!k) {
            return c.status(403).render("permission-denied");
          }
          n.readFile(g, "utf8", (a, b) => {
            if (a) {
              return c.status(500).send("Error reading transcript");
            }
            c.send(b);
          });
        } catch (a) {
          console.error("Error fetching ticket information:", a);
          c.status(500).send("Internal Server Error");
        }
      });
    } catch (a) {
      console.error("Error fetching transcript:", a);
      c.status(500).send("Internal Server Error");
    }
  });
  k.get("/tickets", B, A(q.Pages.Tickets), async (a, b) => {
    try {
      const c = 100;
      const d = parseInt(a.query.page) || 1;
      const e = (d - 1) * c;
      const f = await s.find({
        status: "Closed"
      }).sort({
        closedAt: -1
      });
      const g = await s.find({
        status: "Open"
      });
      const h = await s.countDocuments({
        status: "Open"
      });
      const i = await s.countDocuments({
        status: "Closed"
      });
      const j = await Promise.all(f.map(async a => {
        const b = await E(a.userID);
        const c = a.closeUserID === "alert" ? "Alert Command" : a.closeUserID ? await E(a.closeUserID) : null;
        return {
          ...a._doc,
          username: b.username,
          avatar: b.avatarURL,
          closedBy: c ? typeof c === "string" ? c : c.username : "Unknown",
          closedByAvatar: c ? typeof c === "string" ? "https://i.imgur.com/FxQkyLb.png" : c.avatarURL : "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Faenza-avatar-default-symbolic.svg/2048px-Faenza-avatar-default-symbolic.svg.png"
        };
      }));
      const k = await Promise.all(g.map(async a => {
        const b = await E(a.userID);
        const c = a.claimUser ? await E(a.claimUser) : null;
        return {
          ...a._doc,
          username: b.username,
          avatar: b.avatarURL,
          claimUserInfo: c ? {
            username: c.username,
            avatar: c.avatarURL
          } : {
            username: "Not claimed",
            avatar: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Faenza-avatar-default-symbolic.svg/2048px-Faenza-avatar-default-symbolic.svg.png"
          }
        };
      }));
      const l = [...j, ...k];
      const m = a.query.search;
      const n = m ? l.filter(a => a.username.toLowerCase().includes(m.toLowerCase()) || a.userID.toLowerCase().includes(m.toLowerCase()) || a.ticketType.toLowerCase().includes(m.toLowerCase())) : l;
      const o = n.sort((a, b) => {
        const c = a.closedAt ? new Date(a.closedAt) : new Date(0);
        const d = b.closedAt ? new Date(b.closedAt) : new Date(0);
        return d - c;
      });
      const r = o.length;
      const t = Math.ceil(r / c);
      const u = await F(a.user.id, p.GuildID);
      b.render("tickets", {
        user: a.user,
        tickets: o.slice(e, e + c),
        openTickets: k,
        currentPage: d,
        itemsPerPage: c,
        totalPages: t,
        userRoles: u,
        closedTicketsTotal: i,
        openTicketsTotal: h,
        searchQuery: m,
        config: q
      });
    } catch (c) {
      console.error("Error fetching tickets data:", c);
      b.render("tickets", {
        user: a.user,
        tickets: [],
        currentPage: 1
      });
    }
  });
  k.post("/delete-ticket/:channelId", B, A(q.Actions.DeleteTickets), async (a, b) => {
    try {
      const c = a.params && a.params.channelId;
      await s.findOneAndDelete({
        channelID: c
      });
      b.redirect("/tickets");
    } catch (a) {
      console.error("Error deleting ticket:", a);
      b.redirect("/tickets");
    }
  });
  const G = require("../../models/blacklistedUsersModel");
  k.get("/blacklist", B, A(q.Pages.Blacklist), async (a, b) => {
    try {
      const c = await G.find({
        blacklisted: true
      });
      const d = await Promise.all(c.map(async a => {
        try {
          const b = await E(a.userId);
          return {
            ...a._doc,
            username: b.username,
            avatar: b.avatarURL
          };
        } catch (b) {
          return {
            ...a._doc,
            username: "Unknown",
            avatar: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Faenza-avatar-default-symbolic.svg/2048px-Faenza-avatar-default-symbolic.svg.png"
          };
        }
      }));
      d.sort((a, b) => b.updatedAt - a.updatedAt);
      const e = await F(a.user.id, p.GuildID);
      b.render("blacklist", {
        user: a.user,
        blacklistedUsers: d,
        userRoles: e,
        config: q,
        invalidUserId: false
      });
    } catch (a) {
      console.error("Error fetching blacklisted users:", a);
      b.status(500).send("Internal Server Error");
    }
  });
  k.post("/blacklist", B, A(q.Actions.BlacklistUsers), async (b, c) => {
    const d = b.body.userId;
    const e = b.body.action;
    try {
      const f = a.guilds.cache.get(p.GuildID);
      const g = await f.members.fetch(d).catch(() => null);
      if (g) {
        if (e === "unblacklist") {
          await G.findOneAndUpdate({
            userId: d
          }, {
            $set: {
              blacklisted: false
            }
          });
        } else {
          await G.findOneAndUpdate({
            userId: d
          }, {
            $set: {
              blacklisted: true
            }
          }, {
            upsert: true
          });
        }
        c.redirect("/blacklist");
      } else {
        const a = await G.find({
          blacklisted: true
        });
        const d = await Promise.all(a.map(async a => {
          try {
            const b = await E(a.userId);
            return {
              ...a._doc,
              username: b.username,
              avatar: b.avatarURL
            };
          } catch (b) {
            return {
              ...a._doc,
              username: "Unknown",
              avatar: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Faenza-avatar-default-symbolic.svg/2048px-Faenza-avatar-default-symbolic.svg.png"
            };
          }
        }));
        d.sort((a, b) => b.updatedAt - a.updatedAt);
        const e = await F(b.user.id, p.GuildID);
        c.render("blacklist", {
          user: b.user,
          blacklistedUsers: d,
          userRoles: e,
          config: q,
          invalidUserId: true
        });
      }
    } catch (a) {
      console.error("Error updating user in the blacklist:", a);
      c.status(500).send("Internal Server Error");
    }
  });
  k.get("/embed", B, A(q.Pages.EmbedBuilder), async (a, b) => {
    try {
      b.render("embed", {
        user: a.user
      });
    } catch (a) {
      console.error(a);
      b.status(500).send("Internal Server Error");
    }
  });
  k.get("/embed/channels", B, async (b, c) => {
    try {
      const b = await a.guilds.fetch(p.GuildID);
      const d = await b.channels.fetch();
      const e = d.filter(a => a.type === m.GuildText).map(a => ({
        id: a.id,
        name: a.name
      }));
      c.json({
        channels: e
      });
    } catch (a) {
      console.error("Failed to fetch channels:", a);
      c.status(500).json({
        message: "Failed to fetch channels",
        error: a.message
      });
    }
  });
  k.post("/embed/create", B, A(q.Actions.UseEmbedBuilder), async (b, c) => {
    const {
      title: d,
      description: e,
      color: n = "#000000",
      channelId: f,
      authorName: g,
      authorIconUrl: h,
      imageUrl: i,
      thumbnailUrl: j,
      footerText: k,
      footerIconUrl: l,
      timestamp: m
    } = b.body;
    const o = parseInt((n || "#000000").replace("#", ""), 16);
    if (!f) {
      console.error("Channel ID is undefined.");
    }
    try {
      const n = await a.channels.fetch(f);
      if (n.type !== 0) {
        console.error("Provided channel is not a text channel.");
      }
      const p = {
        title: d,
        description: e,
        color: o,
        timestamp: m ? new Date(m).toISOString() : undefined,
        author: {
          name: g || undefined,
          icon_url: h || undefined,
          url: b.body.authorUrl || undefined
        },
        image: {
          url: i || undefined
        },
        thumbnail: {
          url: j || undefined
        },
        footer: {
          text: k || undefined,
          icon_url: k && l ? l : undefined
        }
      };
      await n.send({
        embeds: [p]
      });
      c.status(200).json({
        message: "Embed sent successfully."
      });
    } catch (a) {
      console.error("Error sending embed:", a);
      c.status(500).json({
        message: "Error sending embed.",
        error: a.message
      });
    }
  });
  const H = require("./Alerts");
  const I = new H(a, p.GuildID);
  k.get("/alerts", B, A(q.Pages.StatusAlerts), async (a, b) => {
    try {
      b.render("alerts", {
        user: a.user
      });
    } catch (a) {
      console.error(a);
      b.status(500).send("Internal Server Error");
    }
  });
  k.get("/api/discord/channels", B, A(q.Pages.StatusAlerts), async (a, b) => {
    try {
      const a = await I.getChannelsFromDiscord();
      b.json(a);
    } catch (a) {
      console.error("Error fetching channels:", a);
      b.status(500).json({
        error: "Failed to fetch channels"
      });
    }
  });
  k.get("/api/discord/channel-name/:channelId", B, A(q.Pages.StatusAlerts), async (b, c) => {
    try {
      const d = await a.channels.fetch(b.params.channelId);
      c.json({
        name: d.name
      });
    } catch (a) {
      console.error("Error fetching channel name:", a);
      c.status(500).json({
        error: "Failed to fetch channel name"
      });
    }
  });
  k.post("/api/alerts/create", B, A(q.Actions.ManageStatusAlerts), async (a, b) => {
    const {
      name: c,
      serverAddress: d,
      type: e,
      channelId: f
    } = a.body;
    if (!c || !d || !e || !f) {
      console.error("Missing required fields in request:", a.body);
      return b.status(400).json({
        error: "Missing required alert properties"
      });
    }
    try {
      const a = await I.createAlert({
        name: c,
        serverAddress: d,
        type: e,
        channelId: f
      });
      b.status(201).json({
        message: "Alert created successfully",
        alertId: a
      });
    } catch (a) {
      console.error("Error creating alert:", a);
      b.status(500).json({
        error: "Failed to create alert"
      });
    }
  });
  k.get("/api/alerts", B, A(q.Pages.StatusAlerts), async (a, b) => {
    try {
      const a = await I.getAllAlerts();
      b.json(a);
    } catch (a) {
      console.error("Error getting alerts:", a);
      b.status(500).json({
        error: "Failed to get alerts"
      });
    }
  });
  k.post("/api/alerts/update", B, A(q.Actions.ManageStatusAlerts), async (a, b) => {
    const {
      alertId: c,
      name: d,
      serverAddress: e,
      type: f,
      channelId: g
    } = a.body;
    try {
      await I.updateAlert(c, {
        name: d,
        serverAddress: e,
        type: f,
        channelId: g
      });
      b.json({
        message: "Alert updated successfully"
      });
    } catch (a) {
      console.error("Error updating alert:", a);
      b.status(500).json({
        error: "Failed to update alert"
      });
    }
  });
  k.post("/api/alerts/delete", B, A(q.Actions.ManageStatusAlerts), async (a, b) => {
    const {
      alertId: c
    } = a.body;
    try {
      await I.deleteAlert(c);
      b.json({
        message: "Alert deleted successfully"
      });
    } catch (a) {
      console.error("Error deleting alert:", a);
      b.status(500).json({
        error: "Failed to delete alert"
      });
    }
  });
  k.get("/", (a, b) => {
    b.redirect("/home");
  });
  k.get("/login", (a, b) => {
    b.render("login");
  });
  k.get("/logout", (a, b) => {
    b.clearCookie("redirectAfterLogin");
    a.logout(a => {
      if (a) {
        console.error("Error during logout:", a);
        return next(a);
      }
      b.redirect("/");
    });
  });
  k.use((a, b, c, d) => {
    console.error(a.stack);
    c.status(500).send("Something went wrong!");
  });
  const J = require("ansi-colors");
  k.listen(v, () => {
    console.log("――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――\n" + J.green.bold.underline("Plex Tickets Dashboard " + z + " has been successfully loaded!") + "\n" + ("Dashboard server is running on " + q.URL + "\n") + (J.yellow("https://plexdevelopment.net/store/dashboard") + "\n") + (J.bold.green("Made by Plex Development") + "\n――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――"));
  });
};