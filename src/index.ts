import { Context, Schema } from 'koishi'
import cron from 'node-cron'
import axios from 'axios'
import ical from 'ical'
import fs from 'fs'
import { HttpsProxyAgent } from 'https-proxy-agent'

export interface Config {
  webcalUrl: string
  targetId: string // 改为 platform:id 格式
  cronTime: string
  messageTemplate: string
  proxy?: string
}

export const Config: Schema<Config> = Schema.object({
  webcalUrl: Schema.string().description('Webcal/ics 日历订阅地址（支持 http/https/webcal）'),
  targetId: Schema.string().description('目标频道/群号，格式如 onebot:123456789 或 discord:频道ID'),
  cronTime: Schema.string().default('0 8 * * *').description('定时任务的 cron 表达式（如每天8点：0 8 * * *）'),
  messageTemplate: Schema.string().default('{summary}\n开始时间: {start}\n结束时间: {end}\n地点: {location}')
    .description('输出内容模板，可用变量：{summary}、{start}、{end}、{location}'),
  proxy: Schema.string().description('可选，访问日历时使用的 http/https 代理地址（如 http://127.0.0.1:7890）').required(false),
})

interface SimpleLogger {
  info: (msg: string, ...args: any[]) => void
  error: (msg: string, ...args: any[]) => void
}

async function getTodayEvents(
  webcalUrl: string,
  messageTemplate: string,
  logger: SimpleLogger,
  proxy?: string
): Promise<string> {
  try {
    logger.info('开始获取日历数据...')
    const url = webcalUrl.replace(/^webcal:/, 'https:')
    logger.info('请求日历地址: %s', url)
    const axiosOptions: any = {}
    if (proxy) {
      axiosOptions.httpsAgent = new HttpsProxyAgent(proxy)
      logger.info('使用代理: %s', proxy)
    }
    const res = await axios.get(url, axiosOptions)
    logger.info('获取到日历原始数据，长度: %d', res.data.length)
    const data = ical.parseICS(res.data)
    logger.info('解析日历数据完成')

    const now = new Date()
    const ongoingEvents: any[] = []
    const upcomingEvents: any[] = []

    for (const k in data) {
      const event = data[k]
      if (event.type === 'VEVENT' && event.start) {
        const start = new Date(event.start)
        const end = event.end ? new Date(event.end) : null
        if (start <= now && (!end || now < end)) {
          ongoingEvents.push(event)
        } else if (start > now) {
          upcomingEvents.push(event)
        }
      }
    }

    // 对即将进行的活动按开始时间排序，取最近的 3 个（可自定义数量）
    upcomingEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    const upcomingToShow = upcomingEvents.slice(0, 3)

    let result = ''
    if (ongoingEvents.length) {
      const messages = ongoingEvents.map(event => {
        const start = new Date(event.start)
        const end = event.end ? new Date(event.end) : null
        return messageTemplate
          .replace('{summary}', event.summary || '无标题')
          .replace('{start}', start.toLocaleString())
          .replace('{end}', end ? end.toLocaleString() : '无')
          .replace('{location}', event.location || '无')
      })
      result += `【正在进行的活动】\n${messages.join('\n\n')}\n`
    } else {
      result += '【正在进行的活动】\n没有找到正在进行的活动。\n'
    }

    if (upcomingToShow.length) {
      const messages = upcomingToShow.map(event => {
        const start = new Date(event.start)
        const end = event.end ? new Date(event.end) : null
        return messageTemplate
          .replace('{summary}', event.summary || '无标题')
          .replace('{start}', start.toLocaleString())
          .replace('{end}', end ? end.toLocaleString() : '无')
          .replace('{location}', event.location || '无')
      })
      result += `\n【即将开始的活动】\n${messages.join('\n\n')}`
    } else {
      result += '\n【即将开始的活动】\n没有找到即将开始的活动。'
    }

    logger.info('匹配到 %d 个正在进行的活动，%d 个即将开始的活动', ongoingEvents.length, upcomingToShow.length)
    return result.trim()
  } catch (err: any) {
    logger.error('日历读取失败: %o', err)
    // 明确返回字符串，避免 undefined
    return '日历读取失败: ' + (err?.message || err)
  }
}

function parseTarget(targetId?: string) {
  if (!targetId || typeof targetId !== 'string' || !targetId.includes(':')) {
    return null
  }
  const [platform, id] = targetId.split(':')
  if (!platform || !id) return null
  return { platform, id }
}

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('webcal')
  cron.schedule(config.cronTime, async () => {
    logger.info('定时任务触发，开始获取并发送日历事项')
    const message = await getTodayEvents(config.webcalUrl, config.messageTemplate, logger, config.proxy)
    const target = parseTarget(config.targetId)
    if (target) {
      const { platform, id } = target
      const bot = ctx.bots.find(bot => bot.platform === platform)
      if (bot) {
        await bot.sendMessage(id, message)
        logger.info('日历事项已发送到 %s 平台: %s', platform, id)
      } else {
        logger.error('未找到平台 %s 的 bot，无法发送消息', platform)
      }
    } else {
      logger.warn('未配置 targetId，定时任务仅生成消息但未发送。')
    }
  })

  ctx
    .command('webcal.today')
    .alias('最近活动')
    .channelFields(['id'])// 允许在群聊/频道使用
    .action(async () => {
      logger.info('手动指令触发，开始获取日历事项')
      try {
        const message = await getTodayEvents(config.webcalUrl, config.messageTemplate, logger, config.proxy)
        // 只返回内容，不推送到 targetId
        return message
      } catch (err: any) {
        logger.error('指令执行异常: %o', err)
        return '发生未知错误: ' + (err?.message || err)
      }
    })
}
