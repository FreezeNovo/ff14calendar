var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var import_node_cron = __toESM(require("node-cron"));
var import_axios = __toESM(require("axios"));
var import_ical = __toESM(require("ical"));
var import_https_proxy_agent = require("https-proxy-agent");
var Config = import_koishi.Schema.object({
  webcalUrl: import_koishi.Schema.string().description("Webcal/ics 日历订阅地址（支持 http/https/webcal）"),
  targetId: import_koishi.Schema.array(import_koishi.Schema.string()).role("textarea").description("目标频道/群号，每行一个，格式如 onebot:123456789 或 discord:频道ID"),
  cronTime: import_koishi.Schema.string().default("0 8 * * *").description("定时任务的 cron 表达式（如每天8点：0 8 * * *）"),
  messageTemplate: import_koishi.Schema.string().default("{summary}\n开始时间: {start}\n结束时间: {end}\n地点: {location}").description("输出内容模板，可用变量：{summary}、{start}、{end}、{location}"),
  proxy: import_koishi.Schema.string().description("可选，访问日历时使用的 http/https 代理地址（如 http://127.0.0.1:7890）").required(false)
});
async function getTodayEvents(webcalUrl, messageTemplate, logger, proxy) {
  try {
    logger.info("开始获取日历数据...");
    const url = webcalUrl.replace(/^webcal:/, "https:");
    logger.info("请求日历地址: %s", url);
    const axiosOptions = {};
    if (proxy) {
      axiosOptions.httpsAgent = new import_https_proxy_agent.HttpsProxyAgent(proxy);
      logger.info("使用代理: %s", proxy);
    }
    const res = await import_axios.default.get(url, axiosOptions);
    logger.info("获取到日历原始数据，长度: %d", res.data.length);
    const data = import_ical.default.parseICS(res.data);
    logger.info("解析日历数据完成");
    const now = /* @__PURE__ */ new Date();
    const ongoingEvents = [];
    const upcomingEvents = [];
    for (const k in data) {
      const event = data[k];
      if (event.type === "VEVENT" && event.start) {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;
        if (start <= now && (!end || now < end)) {
          ongoingEvents.push(event);
        } else if (start > now) {
          upcomingEvents.push(event);
        }
      }
    }
    upcomingEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const upcomingToShow = upcomingEvents.slice(0, 3);
    let result = "";
    if (ongoingEvents.length) {
      const messages = ongoingEvents.map((event) => {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;
        return messageTemplate.replace("{summary}", event.summary || "无标题").replace("{start}", start.toLocaleString()).replace("{end}", end ? end.toLocaleString() : "无").replace("{location}", event.location || "无");
      });
      result += `【正在进行的活动】
${messages.join("\n\n")}
`;
    } else {
      result += "【正在进行的活动】\n没有找到正在进行的活动。\n";
    }
    if (upcomingToShow.length) {
      const messages = upcomingToShow.map((event) => {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;
        return messageTemplate.replace("{summary}", event.summary || "无标题").replace("{start}", start.toLocaleString()).replace("{end}", end ? end.toLocaleString() : "无").replace("{location}", event.location || "无");
      });
      result += `
【即将开始的活动】
${messages.join("\n\n")}`;
    } else {
      result += "\n【即将开始的活动】\n没有找到即将开始的活动。";
    }
    logger.info("匹配到 %d 个正在进行的活动，%d 个即将开始的活动", ongoingEvents.length, upcomingToShow.length);
    return result.trim();
  } catch (err) {
    logger.error("日历读取失败: %o", err);
    return "日历读取失败: " + (err?.message || err);
  }
}
__name(getTodayEvents, "getTodayEvents");
function parseTarget(targetId) {
  if (!targetId || typeof targetId !== "string" || !targetId.includes(":")) {
    return null;
  }
  const [platform, id] = targetId.split(":");
  if (!platform || !id) return null;
  return { platform, id };
}
__name(parseTarget, "parseTarget");
function apply(ctx, config) {
  const logger = ctx.logger("webcal");
  import_node_cron.default.schedule(config.cronTime, async () => {
    logger.info("定时任务触发，开始获取并发送日历事项");
    const message = await getTodayEvents(config.webcalUrl, config.messageTemplate, logger, config.proxy);
    let sent = false;
    for (const t of config.targetId) {
      const target = parseTarget(t);
      if (target) {
        const { platform, id } = target;
        const bot = ctx.bots.find((bot2) => bot2.platform === platform);
        if (bot) {
          await bot.sendMessage(id, message);
          logger.info("日历事项已发送到 %s 平台: %s", platform, id);
          sent = true;
        } else {
          logger.error("未找到平台 %s 的 bot，无法发送消息", platform);
        }
      }
    }
    if (!sent) {
      logger.warn("未配置有效 targetId，定时任务仅生成消息但未发送。");
    }
  });
  ctx.command("webcal.today").alias("最近活动").channelFields(["id"]).action(async () => {
    logger.info("手动指令触发，开始获取日历事项");
    try {
      const message = await getTodayEvents(config.webcalUrl, config.messageTemplate, logger, config.proxy);
      return message;
    } catch (err) {
      logger.error("指令执行异常: %o", err);
      return "发生未知错误: " + (err?.message || err);
    }
  });
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply
});
