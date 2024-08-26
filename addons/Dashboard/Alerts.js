const c = require("axios");
const d = require("mongoose");
const {
  Client: e,
  EmbedBuilder: f,
  ChannelType: g
} = require("discord.js");
const h = new d.Schema({
  alertId: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  serverAddress: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  lastReported: {
    type: Date,
    default: Date.now
  }
});
const i = new d.Schema({
  _id: {
    type: String,
    default: "alertsid"
  },
  seq: {
    type: Number,
    default: 0
  }
});
const j = d.model("Counter", i);
const k = d.model("Alert", h);
class l {
  constructor(a, b) {
    this.client = a;
    this.guildId = b;
    this.client.once("ready", this.onReady.bind(this));
  }
  async onReady() {
    try {
      while (d.connection.readyState !== 1) {
        await new Promise(a => setTimeout(a, 1000));
      }
      const a = await d.connection.db.listCollections({
        name: "counters"
      }).hasNext();
      if (!a) {
        await j.create({
          _id: "alertsid",
          seq: 0
        });
      }
      const b = await d.connection.db.listCollections({
        name: "alerts"
      }).hasNext();
      if (!b) {
        await d.connection.db.createCollection("alerts");
      }
      this.startMonitoring();
    } catch (a) {
      console.error("Error initializing MongoDB collections:", a);
    }
  }
  async createAlert({
    name: a,
    serverAddress: b,
    type: c,
    channelId: d
  }) {
    try {
      const e = await j.findOneAndUpdate({
        _id: "alertsid"
      }, {
        $inc: {
          seq: 1
        }
      }, {
        upsert: true,
        new: true
      });
      if (!e) {
        throw new Error("Failed to increment alert count. The increment result is undefined.");
      }
      const f = e.seq;
      const g = await k.create({
        alertId: f,
        name: a,
        serverAddress: b,
        type: c,
        channelId: d,
        status: "Active"
      });
      return g._id;
    } catch (a) {
      console.error("Error creating alert in DB:", a);
      throw a;
    }
  }
  async getAllAlerts() {
    try {
      const a = await k.find({});
      return a;
    } catch (a) {
      console.error("Error fetching alerts from DB:", a);
      throw a;
    }
  }
  async updateAlert(a, {
    name: b,
    serverAddress: c,
    type: d,
    channelId: e
  }) {
    try {
      const f = parseInt(a);
      const g = await k.updateOne({
        alertId: f
      }, {
        $set: {
          name: b,
          serverAddress: c,
          type: d,
          channelId: e
        }
      });
      return g.nModified;
    } catch (b) {
      console.error("Error updating alert " + a + ":", b);
      throw b;
    }
  }
  async deleteAlert(a) {
    try {
      const b = parseInt(a);
      const c = await k.deleteOne({
        alertId: b
      });
      return c.deletedCount;
    } catch (b) {
      console.error("Error deleting alert " + a + ":", b);
      throw b;
    }
  }
  async monitorAlerts() {
    const a = await this.getAllAlerts();
    for (let b of a) {
      if (b.type === "minecraft") {
        await this.checkMinecraftServer(b);
      } else if (b.type === "website") {
        await this.checkWebsiteStatus(b);
      } else if (b.type === "bots") {
        await this.checkBotStatus(b);
      }
    }
  }
  async getChannelsFromDiscord() {
    if (!this.client.isReady()) {
      return [];
    }
    try {
      const a = await this.client.guilds.fetch(this.guildId);
      const b = Array.from(a.channels.cache.values()).filter(a => a.type === g.GuildText).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type
      }));
      return b;
    } catch (a) {
      throw a;
    }
  }
  async checkMinecraftServer(a) {
    const b = "https://api.mcstatus.io/v2/status/java/" + a.serverAddress;
    c.get(b).then(b => {
      const c = b.data.online;
      const d = c ? "Online" : "Offline";
      if (a.status !== d) {
        this.updateAlertStatus(a.alertId, d);
        this.sendStatusEmbed(a.channelId, a.name, a.serverAddress, d, "minecraft");
      }
    }).catch(b => {
      console.error("Error checking status for " + a.serverAddress + ": ", b);
    });
  }
  async checkWebsiteStatus(a) {
    try {
      const b = await c.get(a.serverAddress);
      const d = b.status === 200;
      const e = d ? "Online" : "Offline";
      if (a.status !== e) {
        this.updateAlertStatus(a.alertId, e);
        this.sendStatusEmbed(a.channelId, a.name, a.serverAddress, e, "website");
      } else {}
    } catch (b) {
      if (b.response) {
        const c = b.response.status;
        if (c === 502) {
          if (a.status !== "Offline") {
            this.updateAlertStatus(a.alertId, "Offline");
            this.sendStatusEmbed(a.channelId, a.name, a.serverAddress, "Offline", "website");
          } else {}
        } else {
          console.error("Error checking status for " + a.serverAddress + ". Received status code: " + c);
        }
      } else if (b.request) {
        if (a.status !== "Offline") {
          this.updateAlertStatus(a.alertId, "Offline");
          this.sendStatusEmbed(a.channelId, a.name, a.serverAddress, "Offline", "website");
        } else {}
      } else {
        console.error("Error checking status for " + a.serverAddress + ": ", b.message);
      }
    }
  }
  async checkBotStatus(a) {
    try {
      const b = await this.client.guilds.fetch(this.guildId);
      if (!b) {
        console.log("Guild with ID " + this.guildId + " not found.");
        return;
      }
      const c = await b.members.fetch(a.serverAddress);
      if (!c.presence) {
        console.log("Presence not available for member " + a.serverAddress);
        return;
      }
      const d = c.presence.status !== "offline";
      const e = d ? "Online" : "Offline";
      if (a.status !== e) {
        this.updateAlertStatus(a.alertId, e);
        this.sendStatusEmbed(a.channelId, a.name, a.serverAddress, e, "bots");
      }
    } catch (b) {
      console.error("Error checking bot online status for " + a.serverAddress + ": ", b);
    }
  }
  async updateAlertStatus(a, b) {
    try {
      const c = parseInt(a);
      const d = new Date();
      const e = await k.updateOne({
        alertId: c
      }, {
        $set: {
          status: b,
          lastReported: d.toISOString()
        }
      });
      return e.modifiedCount;
    } catch (b) {
      console.error("Error updating alert status for " + a + ":", b);
      throw b;
    }
  }
  async sendStatusEmbed(a, b, c, d, e) {
    try {
      const g = await this.client.channels.fetch(a);
      if (!g) {
        console.error("Channel with ID " + a + " not found. Cannot send status embed.");
        return;
      }
      let h = new f().setColor(d === "Online" ? "Green" : "Red").addFields({
        name: "Current Status",
        value: d
      });
      switch (e) {
        case "minecraft":
          h.setTitle("Server Status Alert").setDescription("**" + b + "** status has changed.").addFields({
            name: "Server IP",
            value: c
          });
          break;
        case "bots":
          h.setTitle("Bot Status Alert").setDescription("**" + b + "** status has changed.").addFields({
            name: "Bot",
            value: "<@" + c + ">"
          });
          break;
        case "website":
          h.setTitle("Website Status Alert").setDescription("**" + b + "** status has changed.").addFields({
            name: "Website URL",
            value: c
          });
          break;
      }
      await g.send({
        embeds: [h]
      });
    } catch (a) {
      console.error("Error sending status embed for " + b + ":", a);
    }
  }
  async sendAlertCreatedEmbed(a, {
    name: b,
    serverAddress: c,
    type: d
  }) {
    try {
      const e = await this.client.channels.fetch(a);
      const g = new f().setTitle("Alert Created").setDescription("An alert for **" + b + "** has been set up.").addFields({
        name: "Server Address",
        value: c
      }, {
        name: "Type",
        value: d
      }).setColor("#0099ff");
      await e.send({
        embeds: [g]
      });
    } catch (a) {
      console.error("Error sending alert created embed: ", a);
    }
  }
  startMonitoring() {
    const a = 10000;
    setInterval(() => {
      this.monitorAlerts();
    }, a);
  }
}
module.exports = l;